import { readFile } from 'node:fs/promises';
import PHPParser from 'php-parser';

const pluginPath = 'wordpress/platefullofyum-headless/platefullofyum-headless.php';
const pluginSource = await readFile(pluginPath, 'utf8');
const parser = new PHPParser({
  parser: {
    extractDoc: true,
    php7: true,
    suppressErrors: false
  },
  ast: { withPositions: true }
});
parser.parseCode(pluginSource, pluginPath);
console.info(`PHP syntax parsed: ${pluginPath}`);
