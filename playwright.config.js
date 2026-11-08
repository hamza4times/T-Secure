import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e', testIgnore:'**/auth/**', timeout:45000, fullyParallel:true, workers:2,
  use:{baseURL:'http://127.0.0.1:5175',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{channel:'chrome'}},
  projects:[
    {name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},
    {name:'mobile',use:{...devices['Pixel 7'],defaultBrowserType:'chromium',isMobile:true}},
  ],
  webServer:{
    command:'npm run dev',url:'http://127.0.0.1:5175',reuseExistingServer:false,timeout:60000,
    env:{TSECURE_PORT:'5175',VITE_FIREBASE_API_KEY:'',VITE_FIREBASE_AUTH_DOMAIN:'',VITE_FIREBASE_PROJECT_ID:'',VITE_FIREBASE_APP_ID:'',VITE_USE_FIREBASE_EMULATORS:'false'},
  },
});
