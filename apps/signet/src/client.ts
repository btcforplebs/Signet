import 'websocket-polyfill';
import NDK, {
    NDKEvent,
    NDKNip46Signer,
    NDKPrivateKeySigner,
    NDKUser,
    type NostrEvent,
} from '@nostr-dev-kit/ndk';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const command = argv[0];
let remoteTarget = argv[1];
const payload = argv[2];

const dontPublish = process.argv.includes('--dont-publish');
const debug = process.argv.includes('--debug');

function extractRelays(): string[] {
    const index = process.argv.indexOf('--relays');
    if (index === -1 || !process.argv[index + 1]) {
        return [];
    }
    return process.argv[index + 1].split(',').map((relay) => relay.trim()).filter(Boolean);
}

const extraRelays = extractRelays();

if (!command || !remoteTarget) {
    console.log('Usage: node client sign <remote-npub-or-nip05-or-bunker-token> <content> [--dont-publish] [--debug] [--relays <relay1,relay2>]');
    console.log('');
    console.log('\tcontent: JSON event or text for kind 1');
    process.exit(1);
}

const bunkerToken = remoteTarget.startsWith('bunker://') ? remoteTarget : undefined;
let bunkerRelays: string[] = [];
if (bunkerToken) {
    try {
        const parsed = new URL(bunkerToken.trim());
        bunkerRelays = parsed.searchParams.getAll('relay').map((relay) => decodeURIComponent(relay));
        if (bunkerRelays.length === 0) {
            throw new Error('No relays found in bunker token');
        }
    } catch (error) {
        console.log(`Invalid bunker token: ${(error as Error).message}`);
        process.exit(1);
    }
}

function keyStorageDir(): string {
    const home = process.env.HOME ?? process.env.USERPROFILE;
    if (!home) {
        throw new Error('Unable to locate HOME directory');
    }
    return path.join(home, '.signet-client-private.key');
}

function loadPrivateKey(): string | undefined {
    try {
        return fs.readFileSync(path.join(keyStorageDir(), 'private.key'), 'utf8').trim();
    } catch {
        return undefined;
    }
}

function persistPrivateKey(key: string): void {
    const dir = keyStorageDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'private.key'), key);
}

function buildRelays(defaultsOverride: string[] = []): string[] {
    const defaults = defaultsOverride.length
        ? defaultsOverride
        : [
              'wss://relay.damus.io',
              'wss://relay.primal.net',
              'wss://nost.lol',
          ];
    return [...defaults, ...extraRelays];
}

async function resolveRemoteUser(ndk: NDK): Promise<NDKUser> {
    if (remoteTarget.includes('@') && !remoteTarget.startsWith('npub')) {
        const user = await NDKUser.fromNip05(remoteTarget, ndk);
        if (!user) {
            throw new Error(`Unable to resolve ${remoteTarget}`);
        }
        remoteTarget = user.npub;
        return user;
    }

    return new NDKUser({ npub: remoteTarget });
}

async function createNdk(relaysOverride: string[] = []): Promise<NDK> {
    const ndk = new NDK({
        explicitRelayUrls: buildRelays(relaysOverride),
        enableOutboxModel: false,
    });

    if (debug) {
        ndk.pool.on('relay:disconnect', (relay) => console.log(`Disconnected from ${relay.url}`));
    }

    await ndk.connect(5_000);
    return ndk;
}

async function ensureLocalSigner(): Promise<NDKPrivateKeySigner> {
    const existing = loadPrivateKey();
    if (existing) {
        return new NDKPrivateKeySigner(existing);
    }

    const generated = NDKPrivateKeySigner.generate();
    persistPrivateKey(generated.privateKey!);
    return generated;
}

async function signCommand(ndk: NDK, signer: NDKNip46Signer): Promise<void> {
    if (debug) {
        console.log('Waiting for authorization...');
    }

    const remoteUser = await signer.blockUntilReady();
    if (debug) {
        console.log(`Remote user: ${remoteUser.npub}`);
    }

    let event: NDKEvent;
    try {
        const parsed = JSON.parse(payload ?? '{}');
        event = new NDKEvent(ndk, parsed as NostrEvent);
        if (!event.kind) {
            throw new Error('Event kind missing');
        }
        event.tags ??= [];
        event.content ??= '';
    } catch (error) {
        // Create a minimal event - NDK will fill in created_at and pubkey when signing
        event = new NDKEvent(ndk);
        event.kind = 1;
        event.content = payload ?? '';
        event.tags = [['client', 'signet-client']];
    }

    await event.sign();
    if (debug) {
        console.log(JSON.stringify(event.rawEvent(), null, 2));
    } else {
        console.log(event.sig);
    }

    if (!dontPublish) {
        await event.publish();
    }
}

(async () => {
    try {
        const ndk = await createNdk(bunkerRelays);
        const localSigner = await ensureLocalSigner();

        if (debug) {
            const localUser = await localSigner.user();
            console.log(`Local signer: ${localUser.npub}`);
        }

        let nip46Signer: NDKNip46Signer;

        if (bunkerToken) {
            nip46Signer = NDKNip46Signer.bunker(ndk, bunkerToken, localSigner);
        } else {
            const remoteUser = await resolveRemoteUser(ndk);

            if (debug) {
                console.log(`Remote signer: ${remoteUser.npub}`);
            }

            nip46Signer = new NDKNip46Signer(ndk, remoteUser.pubkey, localSigner);
        }

        nip46Signer.on('authUrl', (url: string) => {
            console.log(`Authorize this request at ${url}`);
        });

        if (command === 'sign') {
            await signCommand(ndk, nip46Signer);
        } else {
            console.log(`Unknown command "${command}"`);
            process.exit(1);
        }
    } catch (error) {
        console.log(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
})();
