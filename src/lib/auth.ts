// src/lib/auth.ts
import { NextRequest } from 'next/server';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
}

// Simple auth for now - returns a mock user
export const auth = {
  async getUser(request: NextRequest): Promise<User | null> {
    // TODO: Implement proper authentication
    // For now, return a mock user
    return {
      id: 'mock-user-id',
      email: 'user@example.com',
      name: 'Test User',
      role: 'USER',
    };
  },
};