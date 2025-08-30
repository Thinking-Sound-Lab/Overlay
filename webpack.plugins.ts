import type IForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import { DefinePlugin } from "webpack";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables directly here
const isDev = process.env.NODE_ENV === "development";
if (isDev) {
  dotenv.config({ path: path.join(process.cwd(), ".env.development") });
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: "webpack-infrastructure",
  }),
  new DefinePlugin({
    "process.env.REACT_APP_SUPABASE_URL": JSON.stringify(
      process.env.REACT_APP_SUPABASE_URL
    ),
    "process.env.REACT_APP_SUPABASE_ANON_KEY": JSON.stringify(
      process.env.REACT_APP_SUPABASE_ANON_KEY
    ),
    "process.env.REACT_APP_POSTHOG_KEY": JSON.stringify(
      process.env.REACT_APP_POSTHOG_KEY
    ),
    "process.env.REACT_APP_POSTHOG_HOST": JSON.stringify(
      process.env.REACT_APP_POSTHOG_HOST
    ),
    "process.env.OPENAI_API_KEY": JSON.stringify(process.env.OPENAI_API_KEY),
    "process.env.WINDOWS_UPDATE_SERVER_URL": JSON.stringify(
      process.env.WINDOWS_UPDATE_SERVER_URL
    ),
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
  }),
];
