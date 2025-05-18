// supabase/functions/create-profile-on-signup/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts' // Assuming you might have a shared CORS setup

// Define the expected structure of the incoming request body (Auth Hook payload)
interface AuthHookPayload {
  type: string;
  table: string;
  record: {
    id: string;
    email?: string;
    raw_user_meta_data?: {
      username?: string; // If you capture username during signup via metadata
      // add other metadata fields if needed
    };
    // Add other fields from auth.users if needed by your logic
  };
  old_record: any | null; // Present for UPDATE/DELETE events
  // Add other potential hook payload fields if necessary
}

// Define the structure for the profile data to be inserted
// Align this with your actual 'profiles' table structure from schema.txt
interface ProfileInsertData {
  id: string; // Must match the user ID
  username: string;
  native_language: { // Default value
    code: string;
    name: string;
    direction: 'ltr' | 'rtl';
  };
  updated_at: string; // Add timestamp
  // Add other fields with default values if needed by your schema
  // Ensure these match the 'profiles' table definition in your schema.txt
  learning_languages?: any[];
  current_levels?: any;
  daily_streak?: number;
  last_practice?: string | null;
  settings?: any | null; // e.g., { hasCompletedOnboarding: false }
  daily_message_count?: number;
  last_message_date?: string | null;
}


// Helper function to generate a unique username
async function generateUniqueUsername(supabaseAdmin: SupabaseClient, baseUsername: string, userId: string): Promise<string> {
  let username = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, '').substring(0, 20); // Clean and shorten
  if (!username) username = `user_${userId.substring(0,6)}`; // Fallback if email parsing fails or base is empty

  let counter = 0;
  let isUnique = false;
  let finalUsername = username;

  while (!isUnique && counter <= 100) { // Safety limit for loop
    const { data, error, count } = await supabaseAdmin
      .from('profiles')
      .select('username', { count: 'exact', head: true }) // Efficiently check existence
      .eq('username', finalUsername);

    if (error) {
      console.error(`Edge Function: Error checking username uniqueness for '${finalUsername}':`, error.message);
      // Fallback strategy if DB check fails: append random characters
      // This is a simple fallback; more robust error handling might be needed for production
      finalUsername = `${username}_${Math.random().toString(36).substring(2, 7)}`;
      counter++; // Increment counter to eventually break loop or try new random name
      continue;
    }

    if (count === 0) {
      isUnique = true; // Username is unique
    } else {
      counter++;
      finalUsername = `${username}${counter}`; // Append counter and try again
    }
  }

  if (!isUnique) {
     // If still not unique after many tries, use a more random suffix
     console.warn(`Edge Function: Could not generate unique username for base '${baseUsername}' after ${counter} attempts. Using more random suffix.`);
     finalUsername = `${username}_${Math.random().toString(36).substring(2, 8)}`;
  }
  return finalUsername;
}


console.log("Edge Function 'create-profile-on-signup' is initializing.");

serve(async (req: Request) => {
  // 1. Handle CORS preflight requests (important for local testing if calling directly)
  if (req.method === 'OPTIONS') {
    console.log("Edge Function: Handling OPTIONS request.");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Ensure critical environment variables are set using NEW NAMES
    const supabaseUrl = Deno.env.get('PROJECT_URL'); // CHANGED
    const serviceRoleKey = Deno.env.get('PROJECT_SERVICE_ROLE_KEY'); // CHANGED

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Edge Function Critical Error: Missing PROJECT_URL or PROJECT_SERVICE_ROLE_KEY environment variables."); // UPDATED ERROR MSG
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // 3. Parse the incoming request body (this will be the Auth Hook payload)
    let payload: AuthHookPayload;
    try {
      payload = await req.json();
      console.log("Edge Function: Received payload:", JSON.stringify(payload, null, 2));
    } catch (e) {
      console.error("Edge Function Error: Failed to parse request body:", e.message);
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Bad Request
      });
    }

    // 4. Validate the payload: We only care about INSERT events on the 'users' table from auth.
    if (payload.type !== 'INSERT' || payload.table !== 'users' || !payload.record) {
      console.log(`Edge Function: Ignoring event type '${payload.type}' on table '${payload.table}'. Only processing INSERT on 'users'.`);
      return new Response(JSON.stringify({ message: 'Event type not applicable or record missing.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Acknowledge receipt but indicate no action taken
      });
    }

    const userData = payload.record;
    const userId = userData.id;
    const userEmail = userData.email; // Email should always be present for new auth users

    if (!userId || typeof userId !== 'string' || !userEmail || typeof userEmail !== 'string') {
      console.error("Edge Function Error: Missing or invalid user ID or email in payload record.", userData);
      return new Response(JSON.stringify({ error: 'Payload record missing required user ID or email.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Bad Request
      });
    }

    // 5. Create a Supabase client instance using the Service Role Key.
    // This client bypasses Row-Level Security (RLS) policies.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
       auth: {
         autoRefreshToken: false, // Not needed for service role
         persistSession: false    // Not needed for service role
       }
    });
    console.log("Edge Function: Admin Supabase client initialized.");

    // 6. Check if a profile already exists for this user ID to prevent duplicates.
    // This is a good safety measure, though ideally, the hook fires only once per user.
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id') // Select a minimal column just to check existence
      .eq('id', userId)
      .maybeSingle(); // Returns one row or null, doesn't error if not found

    if (checkError) {
       console.error(`Edge Function Error: Database error checking for existing profile for user '${userId}':`, checkError.message);
       return new Response(JSON.stringify({ error: `Database error: ${checkError.message}` }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 500, // Internal Server Error
       });
    }

    if (existingProfile) {
      console.log(`Edge Function: Profile already exists for user '${userId}'. Skipping creation.`);
      return new Response(JSON.stringify({ message: 'Profile already exists for this user.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // OK, but indicate profile was already there
      });
    }

    // 7. Prepare the data for the new profile.
    // Generate a unique username. Use email prefix or provided metadata.
    const baseUsername = userData.raw_user_meta_data?.username || userEmail.split('@')[0] || `user`;
    const uniqueUsername = await generateUniqueUsername(supabaseAdmin, baseUsername, userId);
    console.log(`Edge Function: Generated unique username '${uniqueUsername}' for user '${userId}'.`);

    const newProfileData: ProfileInsertData = {
      id: userId, // This MUST match the auth.users.id
      username: uniqueUsername,
      native_language: { code: 'en', name: 'English', direction: 'ltr' }, // Default native language
      updated_at: new Date().toISOString(), // Set current timestamp for updated_at
      // Initialize other fields as per your schema defaults or requirements
      learning_languages: [],
      current_levels: {},
      daily_streak: 0,
      last_practice: null,
      settings: { hasCompletedOnboarding: false }, // Default onboarding status
      daily_message_count: 0,
      last_message_date: null,
    };

    // 8. Insert the new profile into the 'profiles' table.
    console.log(`Edge Function: Attempting to insert profile for user '${userId}' with data:`, JSON.stringify(newProfileData));
    const { error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert(newProfileData);

    if (insertError) {
      console.error(`Edge Function Error: Failed to insert profile for user '${userId}':`, insertError.message);
      // Log more details if available
      console.error(`Edge Function: Insert error details: code=${insertError.code}, details=${insertError.details}, hint=${insertError.hint}`);
      return new Response(JSON.stringify({ error: `Failed to create profile in database: ${insertError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Internal Server Error
      });
    }

    console.log(`Edge Function: Successfully created profile for user '${userId}'.`);

    // 9. Return a success response to the Auth Hook.
    return new Response(JSON.stringify({ message: 'Profile created successfully by Edge Function.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // OK
    })
  } catch (error) {
    // Catch any unexpected errors during the function execution.
    console.error("Edge Function: Unhandled top-level error:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error occurred in Edge Function.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

/*
Reminder of Deployment Steps:
1. Ensure Supabase CLI is installed and you are logged in (`supabase login`).
2. Link your project: `supabase link --project-ref YOUR_PROJECT_REF`
3. Set secrets for deployment (if not already set), USING NEW NAMES:
   `supabase secrets set PROJECT_URL=YOUR_SUPABASE_PROJECT_URL`
   `supabase secrets set PROJECT_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY`
4. Deploy the function: `supabase functions deploy create-profile-on-signup --no-verify-jwt`
5. Set up the Auth Hook in your Supabase dashboard:
   - Go to Authentication > Auth Hooks.
   - Click "+ Add Hook".
   - Name: e.g., "Create Profile on Signup"
   - Event: "User Signed Up"
   - Hook Type: "HTTPS Request"
   - HTTPS Endpoint URL: The URL of this deployed Edge Function (find in Supabase Dashboard > Edge Functions).
   - Ensure the hook is Enabled.
*/
