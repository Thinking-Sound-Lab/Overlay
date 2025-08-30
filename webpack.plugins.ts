import type IForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import { DefinePlugin } from "webpack";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables directly here
// const envFile =
//   process.env.NODE_ENV === "development" ? ".env.development" : ".env";
// dotenv.config({ path: path.join(process.cwd(), envFile) });

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: "webpack-infrastructure",
  }),
  new DefinePlugin({
    "process.env": {
      REACT_APP_SUPABASE_URL: JSON.stringify(
        process.env.REACT_APP_SUPABASE_URL
      ),
      REACT_APP_SUPABASE_ANON_KEY: JSON.stringify(
        process.env.REACT_APP_SUPABASE_ANON_KEY
      ),
      REACT_APP_POSTHOG_KEY: JSON.stringify(process.env.REACT_APP_POSTHOG_KEY),
      REACT_APP_POSTHOG_HOST: JSON.stringify(
        process.env.REACT_APP_POSTHOG_HOST
      ),
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || "development"),
      OPENAI_API_KEY: JSON.stringify(process.env.OPENAI_API_KEY),
    },
  }),
];
