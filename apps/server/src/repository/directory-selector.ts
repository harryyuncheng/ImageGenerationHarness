import { execFile } from 'node:child_process';

export interface DirectorySelector {
  selectDirectory(): Promise<string | undefined>;
}

interface ExecFileFailure extends Error {
  stderr?: string;
}

function executeAppleScript(args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile('/usr/bin/osascript', args, { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        reject(error instanceof Error ? error : new Error('The directory chooser failed.'));
        return;
      }
      resolvePromise(stdout);
    });
  });
}

export class MacOSDirectorySelector implements DirectorySelector {
  async selectDirectory(): Promise<string | undefined> {
    const script = [
      'set selectedDirectory to choose folder with prompt "Choose an ImageGenerationHarness repository"',
      'POSIX path of selectedDirectory',
    ].join('\n');
    try {
      const output = await executeAppleScript(['-e', script]);
      const selectedPath = output.trim();
      return selectedPath || undefined;
    } catch (error) {
      const failure = error as ExecFileFailure;
      if (`${failure.message}\n${failure.stderr ?? ''}`.includes('User canceled')) return undefined;
      throw error;
    }
  }
}
