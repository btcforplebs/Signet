import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppService } from '../app-service.js';
import { createMockKeyUser } from '../../testing/mocks.js';

// Mock the repository
vi.mock('../../repositories/index.js', () => ({
  appRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    revoke: vi.fn(),
    updateDescription: vi.fn(),
    getRequestCount: vi.fn(),
    countActive: vi.fn(),
  },
}));

describe('AppService', () => {
  let service: AppService;
  let mockAppRepository: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const repoModule = await import('../../repositories/index.js');
    mockAppRepository = repoModule.appRepository;

    service = new AppService();
  });

  describe('listApps', () => {
    it('should return formatted app list', async () => {
      const mockKeyUsers = [
        createMockKeyUser({
          id: 1,
          keyName: 'main-key',
          description: 'Test App',
          signingConditions: [
            { id: 1, method: 'sign_event', kind: null, allowed: true },
            { id: 2, method: 'connect', kind: null, allowed: true }, // Should be filtered out
          ],
        }),
      ];

      mockAppRepository.findAll.mockResolvedValue(mockKeyUsers);
      mockAppRepository.getRequestCount.mockResolvedValue(10);

      const result = await service.listApps();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        keyName: 'main-key',
        userPubkey: expect.any(String),
        description: 'Test App',
        permissions: ['sign_event'], // 'connect' should be filtered out
        connectedAt: expect.any(String),
        lastUsedAt: null,
        requestCount: 10,
      });
    });

    it('should return "All methods" when no specific permissions', async () => {
      const mockKeyUsers = [
        createMockKeyUser({
          id: 1,
          signingConditions: [],
        }),
      ];

      mockAppRepository.findAll.mockResolvedValue(mockKeyUsers);
      mockAppRepository.getRequestCount.mockResolvedValue(0);

      const result = await service.listApps();

      expect(result[0].permissions).toEqual(['All methods']);
    });

    it('should include kind in permission string when present', async () => {
      const mockKeyUsers = [
        createMockKeyUser({
          id: 1,
          signingConditions: [
            { id: 1, method: 'sign_event', kind: 1, allowed: true },
          ],
        }),
      ];

      mockAppRepository.findAll.mockResolvedValue(mockKeyUsers);
      mockAppRepository.getRequestCount.mockResolvedValue(0);

      const result = await service.listApps();

      expect(result[0].permissions).toContain('sign_event (kind 1)');
    });
  });

  describe('revokeApp', () => {
    it('should revoke app when found', async () => {
      mockAppRepository.findById.mockResolvedValue(createMockKeyUser({ id: 1 }));
      mockAppRepository.revoke.mockResolvedValue(undefined);

      await service.revokeApp(1);

      expect(mockAppRepository.revoke).toHaveBeenCalledWith(1);
    });

    it('should throw when app not found', async () => {
      mockAppRepository.findById.mockResolvedValue(null);

      await expect(service.revokeApp(999)).rejects.toThrow('App not found');
    });
  });

  describe('updateDescription', () => {
    it('should update description when app found', async () => {
      mockAppRepository.findById.mockResolvedValue(createMockKeyUser({ id: 1 }));
      mockAppRepository.updateDescription.mockResolvedValue(undefined);

      await service.updateDescription(1, 'New Name');

      expect(mockAppRepository.updateDescription).toHaveBeenCalledWith(1, 'New Name');
    });

    it('should throw when app not found', async () => {
      mockAppRepository.findById.mockResolvedValue(null);

      await expect(service.updateDescription(999, 'New Name')).rejects.toThrow('App not found');
    });
  });

  describe('countActive', () => {
    it('should return active app count', async () => {
      mockAppRepository.countActive.mockResolvedValue(5);

      const result = await service.countActive();

      expect(result).toBe(5);
    });
  });
});
