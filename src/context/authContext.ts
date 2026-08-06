import { createContext } from 'react';
import type { RegionId } from '../types';
import type { AppUser } from '../types/auth';

export interface AuthContextValue {
  user: AppUser;
  selectedRegionId: RegionId | null;
  setUser: (user: AppUser) => void;
  setSelectedRegionId: (id: RegionId | null) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
