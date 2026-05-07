/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as challengeParticipants from "../challengeParticipants.js";
import type * as challenges from "../challenges.js";
import type * as dexaScans from "../dexaScans.js";
import type * as lib_scoring from "../lib/scoring.js";
import type * as participants from "../participants.js";
import type * as weeklyWeighIns from "../weeklyWeighIns.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  challengeParticipants: typeof challengeParticipants;
  challenges: typeof challenges;
  dexaScans: typeof dexaScans;
  "lib/scoring": typeof lib_scoring;
  participants: typeof participants;
  weeklyWeighIns: typeof weeklyWeighIns;
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
