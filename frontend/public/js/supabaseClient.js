// SEP_SaigonBistro/frontend/public/js/supabaseClient.js
// -handles login / logout / session refresh 
// -stores JWT in localStorage
// -sends access_token → backend
// Browser (5173)use this file supabaseClient.js and fetch("http://127.0.0.1:3000/api/me") Authorization: Bearer <JWT>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(
  "https://gsckhgdamzdtarnrreqn.supabase.co",
  "sb_publishable_1UWWTtQ7KBvelXkTiser1A_rhxH9pFp"
);
