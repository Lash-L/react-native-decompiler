import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

async function runDecompiler(options: { in: string, out: string }): Promise<{ stdout: string, stderr: string }> {
  const cmd = `node ./out/main.js -i ${options.in} -o ${options.out} --noEslint --noPrettier --noProgress`;
  return execPromise(cmd);
}

describe('Decompiler', () => {
  const bundlePath = path.join(__dirname, '..', 'ex_index.android.bundle.bundle');
  const outputDir = path.join(__dirname, 'output');

  beforeEach(() => {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir);
  });

  afterEach(() => {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('should only find one occurrence of "getMapDiffDynamic" in successfully decompiled modules', async () => {
    const { stdout } = await runDecompiler({
      in: bundlePath,
      out: outputDir,
    });

    const failedModuleIds = (stdout.match(/An error occured parsing module (\d+)/g) || [])
        .map(line => line.match(/(\d+)/)![1]);

    let decompiledOccurrences = 0;
    const files = fs.readdirSync(outputDir);
    for (const file of files) {
      const filePath = path.join(outputDir, file);
      if (fs.lstatSync(filePath).isDirectory() || file.endsWith('.cache')) {
        continue;
      }

      const moduleId = file.split('.')[0];
      if (failedModuleIds.includes(moduleId)) {
          continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      decompiledOccurrences += (content.match(/getMapDiffDynamic/g) || []).length;
    }

    expect(decompiledOccurrences).toBe(1);
  }, 300000); // 5 minutes timeout for the test
});