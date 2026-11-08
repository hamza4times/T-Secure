import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir:'./pwa-tests',
  outputDir:'./artifacts/pwa/test-results',
  fullyParallel:false,
  workers:1,
  timeout:30000,
  use:{
    baseURL:'http://127.0.0.1:5177',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    permissions:['microphone'],
    launchOptions:{channel:'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']},
  },
  projects:[
    {name:'desktop',use:{...devices['Desktop Chrome']}},
    {name:'mobile',use:{...devices['Pixel 7'],defaultBrowserType:'chromium'}},
  ],
  webServer:{
    command:'node pwa-tests/server.mjs',
    url:'http://127.0.0.1:5177',
    reuseExistingServer:false,
    timeout:60000,
    env:{VITE_FIREBASE_API_KEY:'',VITE_FIREBASE_AUTH_DOMAIN:'',VITE_FIREBASE_PROJECT_ID:'',VITE_FIREBASE_APP_ID:''},
  },
});
