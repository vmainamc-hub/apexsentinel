import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PlatformRole } from "@reef-sites/shared-types";

type PlatformAccess = {
  role: PlatformRole | "legacy_admin" | null;
  isAdmin: boolean;
  canManageSites: boolean;
  canSupport: boolean;
  canViewFinance: boolean;
  loading: boolean;
};

const rank: Array<PlatformRole> = ["super_admin", "operations_admin", "support_admin", "finance_viewer"];

export const useAdminRole = (): PlatformAccess => {
  const { user } = useAuth();
  const [access, setAccess] = useState<Omit<PlatformAccess, "loading">>({ role: null, isAdmin: false, canManageSites: false, canSupport: false, canViewFinance: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!user) {
        if (active) { setAccess({ role: null, isAdmin: false, canManageSites: false, canSupport: false, canViewFinance: false }); setLoading(false); }
        return;
      }
      setLoading(true);
      try {
        // Generated database types are refreshed only after the migration is applied.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const [legacy, memberships] = await Promise.all([
          db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
          db.from("organisation_members").select("role").eq("user_id", user.id).eq("status", "active").in("role", rank),
        ]);
        if (legacy.error) throw legacy.error;
        if (memberships.error) throw memberships.error;
        const roles = new Set<PlatformRole>((memberships.data || []).map((row: { role: PlatformRole }) => row.role));
        const role = legacy.data ? "legacy_admin" : rank.find(candidate => roles.has(candidate)) || null;
        const full = role === "legacy_admin" || role === "super_admin";
        if (active) setAccess({
          role,
          isAdmin: role !== null,
          canManageSites: full || role === "operations_admin",
          canSupport: full || role === "support_admin",
          canViewFinance: full || role === "finance_viewer",
        });
      } catch (error) {
        console.error("Error checking platform permissions:", error);
        if (active) setAccess({ role: null, isAdmin: false, canManageSites: false, canSupport: false, canViewFinance: false });
      } finally {
        if (active) setLoading(false);
      }
    };
    void check();
    return () => { active = false; };
  }, [user]);

  return { ...access, loading };
};
