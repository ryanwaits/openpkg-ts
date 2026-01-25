import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';

const COMPONENTS_JSON = 'components.json';
const REGISTRY_URL =
  'https://raw.githubusercontent.com/anthropics/openpkg-ts/main/registry/r/{name}.json';

interface ComponentsJson {
  $schema: string;
  style: string;
  rsc: boolean;
  tsx: boolean;
  tailwind: {
    config: string;
    css: string;
    baseColor: string;
    cssVariables: boolean;
    prefix: string;
  };
  aliases: {
    components: string;
    utils: string;
    ui: string;
    lib: string;
    hooks: string;
  };
  registries?: Record<string, string>;
}

function loadComponentsJson(): ComponentsJson | null {
  const configPath = path.resolve(COMPONENTS_JSON);
  if (!fs.existsSync(configPath)) return null;
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

export function createInitCommand(): Command {
  return new Command('init')
    .description('Add @openpkg registry to components.json for shadcn CLI')
    .option('--registry <url>', 'Custom registry URL', REGISTRY_URL)
    .action(async (options: { registry?: string }) => {
      const configPath = path.resolve(COMPONENTS_JSON);
      const registryUrl = options.registry || REGISTRY_URL;

      // Check if components.json exists
      if (!fs.existsSync(configPath)) {
        console.error(`${COMPONENTS_JSON} not found.`);
        console.error('Run "npx shadcn@latest init" first to initialize shadcn.');
        process.exit(1);
      }

      // Load and update components.json
      const config = loadComponentsJson();
      if (!config) {
        console.error(`Failed to parse ${COMPONENTS_JSON}`);
        process.exit(1);
      }

      // Add openpkg registry
      config.registries = config.registries || {};
      config.registries['@openpkg'] = registryUrl;

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      console.log(`Added @openpkg registry to ${COMPONENTS_JSON}`);
      console.log('');
      console.log('Usage:');
      console.log('  npx shadcn@latest add @openpkg/function-section');
      console.log('  npx shadcn@latest add @openpkg/export-card');
      console.log('');
      console.log('List components:');
      console.log('  openpkg docs list');
    });
}
