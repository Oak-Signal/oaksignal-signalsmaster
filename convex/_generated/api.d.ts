/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as exams from "../exams.js";
import type * as exams_handlers_runtime from "../exams/handlers/runtime.js";
import type * as exams_handlers_settings from "../exams/handlers/settings.js";
import type * as exams_handlers_start from "../exams/handlers/start.js";
import type * as exams_handlers_startMutation from "../exams/handlers/startMutation.js";
import type * as exams_handlers_submission from "../exams/handlers/submission.js";
import type * as exams_services_audit from "../exams/services/audit.js";
import type * as exams_services_auth from "../exams/services/auth.js";
import type * as exams_services_config from "../exams/services/config.js";
import type * as exams_services_hash from "../exams/services/hash.js";
import type * as exams_services_query_helpers from "../exams/services/query_helpers.js";
import type * as exams_services_result_builder from "../exams/services/result_builder.js";
import type * as exams_services_time from "../exams/services/time.js";
import type * as flags from "../flags.js";
import type * as lib_distractor_generation from "../lib/distractor_generation.js";
import type * as lib_exam_checksum from "../lib/exam_checksum.js";
import type * as lib_exam_generation from "../lib/exam_generation.js";
import type * as lib_exam_policy from "../lib/exam_policy.js";
import type * as lib_exam_randomization from "../lib/exam_randomization.js";
import type * as lib_exam_session_token from "../lib/exam_session_token.js";
import type * as lib_exam_start_validators from "../lib/exam_start_validators.js";
import type * as lib_exam_types from "../lib/exam_types.js";
import type * as lib_flag_similarity from "../lib/flag_similarity.js";
import type * as lib_performance from "../lib/performance.js";
import type * as lib_randomization from "../lib/randomization.js";
import type * as lib_types from "../lib/types.js";
import type * as practice_sessions from "../practice_sessions.js";
import type * as seed_letters from "../seed/letters.js";
import type * as seed_numbers from "../seed/numbers.js";
import type * as seed_reset from "../seed/reset.js";
import type * as seed_special from "../seed/special.js";
import type * as seed_flags from "../seed_flags.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  exams: typeof exams;
  "exams/handlers/runtime": typeof exams_handlers_runtime;
  "exams/handlers/settings": typeof exams_handlers_settings;
  "exams/handlers/start": typeof exams_handlers_start;
  "exams/handlers/startMutation": typeof exams_handlers_startMutation;
  "exams/handlers/submission": typeof exams_handlers_submission;
  "exams/services/audit": typeof exams_services_audit;
  "exams/services/auth": typeof exams_services_auth;
  "exams/services/config": typeof exams_services_config;
  "exams/services/hash": typeof exams_services_hash;
  "exams/services/query_helpers": typeof exams_services_query_helpers;
  "exams/services/result_builder": typeof exams_services_result_builder;
  "exams/services/time": typeof exams_services_time;
  flags: typeof flags;
  "lib/distractor_generation": typeof lib_distractor_generation;
  "lib/exam_checksum": typeof lib_exam_checksum;
  "lib/exam_generation": typeof lib_exam_generation;
  "lib/exam_policy": typeof lib_exam_policy;
  "lib/exam_randomization": typeof lib_exam_randomization;
  "lib/exam_session_token": typeof lib_exam_session_token;
  "lib/exam_start_validators": typeof lib_exam_start_validators;
  "lib/exam_types": typeof lib_exam_types;
  "lib/flag_similarity": typeof lib_flag_similarity;
  "lib/performance": typeof lib_performance;
  "lib/randomization": typeof lib_randomization;
  "lib/types": typeof lib_types;
  practice_sessions: typeof practice_sessions;
  "seed/letters": typeof seed_letters;
  "seed/numbers": typeof seed_numbers;
  "seed/reset": typeof seed_reset;
  "seed/special": typeof seed_special;
  seed_flags: typeof seed_flags;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
