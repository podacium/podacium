/**
 * UserContext — Profile, skills, and stats management.
 * Depends on AuthContext for the authenticated user.
 */
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  api,
  UserProfileResponse,
  PublicUserProfileResponse,
  UserSkillResponse,
  UserSkillCreate,
  handleApiError,
} from "@/lib/api";
import { useAuth } from "./AuthContext";

// =============================================================================
// TYPES
// =============================================================================

interface UserStats {
  total_learning_time: number;
  completed_courses: number;
  certificates_earned: number;
  current_streak: number;
}

interface PublicProfileUpdateData {
  fullName?: string;
  bio?: string;
  profilePictureUrl?: string;
  country?: string;
  city?: string;
  skills?: string[];
  socialLinks?: Record<string, string>;
  role?: string;
}

export interface UserContextType {
  userProfile: UserProfileResponse | null;
  userStats: UserStats | null;
  userSkills: UserSkillResponse[];
  error: string | null;

  refreshUserProfile: () => Promise<void>;
  refreshUserStats: () => Promise<void>;
  refreshUserSkills: () => Promise<UserSkillResponse[]>;
  updatePublicProfile: (
    data: PublicProfileUpdateData,
  ) => Promise<UserProfileResponse>;
  getUserPublicProfile: (userId: number) => Promise<PublicUserProfileResponse>;
  uploadProfilePicture: (file: File) => Promise<any>;
  addUserSkill: (skillData: UserSkillCreate) => Promise<UserSkillResponse>;
  deleteUserSkill: (skillId: number) => Promise<void>;
  clearError: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, refreshUser } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfileResponse | null>(
    null,
  );
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userSkills, setUserSkills] = useState<UserSkillResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Profile
  const refreshUserProfile = useCallback(async () => {
    setError(null);
    try {
      const profile = await api.getCurrentUserProfile();
      setUserProfile(profile);
    } catch (err) {
      setError(handleApiError(err));
      throw err;
    }
  }, []);

  const updatePublicProfile = useCallback(
    async (data: PublicProfileUpdateData) => {
      setError(null);
      try {
        const updatedProfile = await api.updatePublicProfile(data);
        setUserProfile(updatedProfile);
        await refreshUser();
        return updatedProfile;
      } catch (err) {
        setError(handleApiError(err));
        throw err;
      }
    },
    [refreshUser],
  );

  const getUserPublicProfile = useCallback(async (userId: number) => {
    setError(null);
    try {
      return await api.getUserPublicProfile(userId);
    } catch (err) {
      setError(handleApiError(err));
      throw err;
    }
  }, []);

  const uploadProfilePicture = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const response = await api.uploadFile(file, "avatars");
        if (response.url) {
          await updatePublicProfile({ profilePictureUrl: response.url });
        }
        return response;
      } catch (err) {
        setError(handleApiError(err));
        throw err;
      }
    },
    [updatePublicProfile],
  );

  // Stats
  const refreshUserStats = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    try {
      const dashboardData = await api.getUserDashboard();
      const us = dashboardData.state.user_stats;
      setUserStats({
        total_learning_time: (us?.total_courses ?? 0) * 60,
        completed_courses: us?.completed_courses ?? 0,
        certificates_earned: us?.certifications_count ?? 0,
        current_streak: 0,
      });
    } catch {
      setUserStats({
        total_learning_time: 0,
        completed_courses: 0,
        certificates_earned: 0,
        current_streak: 0,
      });
    }
  }, [user?.id]);

  // Skills
  const refreshUserSkills = useCallback(async (): Promise<
    UserSkillResponse[]
  > => {
    if (!user?.id) return [];
    try {
      const skills = await api.getUserSkills(user.id);
      setUserSkills(skills);
      return skills;
    } catch {
      return [];
    }
  }, [user?.id]);

  const addUserSkill = useCallback(async (skillData: UserSkillCreate) => {
    setError(null);
    try {
      const newSkill = await api.addUserSkill(skillData);
      setUserSkills((prev) => [...prev, newSkill]);
      return newSkill;
    } catch (err) {
      setError(handleApiError(err));
      throw err;
    }
  }, []);

  const deleteUserSkill = useCallback(async (skillId: number) => {
    setError(null);
    try {
      await api.deleteUserSkill(skillId);
      setUserSkills((prev) => prev.filter((s) => s.id !== skillId));
    } catch (err) {
      setError(handleApiError(err));
      throw err;
    }
  }, []);

  const value = useMemo<UserContextType>(
    () => ({
      userProfile,
      userStats,
      userSkills,
      error,
      refreshUserProfile,
      refreshUserStats,
      refreshUserSkills,
      updatePublicProfile,
      getUserPublicProfile,
      uploadProfilePicture,
      addUserSkill,
      deleteUserSkill,
      clearError,
    }),
    [
      userProfile,
      userStats,
      userSkills,
      error,
      refreshUserProfile,
      refreshUserStats,
      refreshUserSkills,
      updatePublicProfile,
      getUserPublicProfile,
      uploadProfilePicture,
      addUserSkill,
      deleteUserSkill,
      clearError,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

// =============================================================================
// HOOK
// =============================================================================

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
