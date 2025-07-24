import { execSync } from 'child_process';

export default function setup() {
  // Build the project before running tests
  execSync('npm run build', { stdio: 'inherit' });
}
