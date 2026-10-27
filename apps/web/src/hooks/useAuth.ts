// src/hooks/useAuth.ts
"use client";

import {
  useAuth as useAuthContext,
  useOptionalAuth as useOptionalAuthContext,
} from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useState, useCallback } from "react";
import {
  api,
  UserProfileResponse,
  PublicUserProfileResponse,
  UserSkillResponse,
  UserSkillCreate,
  PublicProfileUpdate,
  PrivateSettingsUpdate,
  ApiError,
  NetworkError,
  AuthenticationError,
  handleApiError,
} from "@/lib/api";

// Re-export AuthContext hooks with proper typing
export const useAuth = useAuthContext;
export const useOptionalAuth = useOptionalAuthContext;

// Profile-specific hooks
export const useProfile = () => {
  const { userProfile, refreshUserProfile, updatePublicProfile } = useUser();

  const updateProfile = useCallback(
    async (data: PublicProfileUpdate) => {
      return await updatePublicProfile(data);
    },
    [updatePublicProfile],
  );

  const refreshProfile = useCallback(async () => {
    return await refreshUserProfile();
  }, [refreshUserProfile]);

  return {
    profile: userProfile,
    updateProfile,
    refreshProfile,
    isLoading: !userProfile,
  };
};

export const useUserStats = () => {
  const { userStats, refreshUserStats } = useUser();

  const refreshStats = useCallback(async () => {
    return await refreshUserStats();
  }, [refreshUserStats]);

  return {
    stats: userStats,
    refreshStats,
    isLoading: !userStats,
  };
};

export const useSkills = () => {
  const { userSkills, addUserSkill, deleteUserSkill, refreshUserSkills } =
    useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSkill = useCallback(
    async (skillName: string) => {
      setLoading(true);
      setError(null);
      try {
        const skillData: UserSkillCreate = { name: skillName };
        const result = await addUserSkill(skillData);
        await refreshUserSkills();
        setLoading(false);
        return result;
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        setLoading(false);
        throw err;
      }
    },
    [addUserSkill, refreshUserSkills],
  );

  const removeSkill = useCallback(
    async (skillId: number) => {
      setLoading(true);
      setError(null);
      try {
        await deleteUserSkill(skillId);
        await refreshUserSkills();
        setLoading(false);
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        setLoading(false);
        throw err;
      }
    },
    [deleteUserSkill, refreshUserSkills],
  );

  const refreshSkills = useCallback(async () => {
    return await refreshUserSkills();
  }, [refreshUserSkills]);

  const clearError = useCallback(() => setError(null), []);

  return {
    skills: userSkills,
    addSkill,
    removeSkill,
    refreshSkills,
    loading,
    error,
    clearError,
  };
};

export const usePublicProfile = (userId: number) => {
  const { getUserPublicProfile } = useUser();
  const [profile, setProfile] = useState<PublicUserProfileResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const publicProfile = await getUserPublicProfile(userId);
      setProfile(publicProfile);
      setLoading(false);
      return publicProfile;
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, [userId, getUserPublicProfile]);

  const clearError = useCallback(() => setError(null), []);

  return {
    profile,
    loading,
    error,
    loadProfile,
    clearError,
  };
};

// Enhanced error handling utilities
export const useAuthErrorHandler = () => {
  const getErrorMessage = (error: unknown): string => {
    return handleApiError(error);
  };

  return { getErrorMessage };
};
