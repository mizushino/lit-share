import {esbuildPlugin} from '@web/dev-server-esbuild';

export default {
  nodeResolve: true,
  watch: true,
  hostname: '0.0.0.0',
  port: parseInt(process.env.PORT, 10) || 3000,
  files: ['src/**/*.ts'],
  plugins: [esbuildPlugin({ts: true, tsconfig: 'tsconfig.json'})],
};
