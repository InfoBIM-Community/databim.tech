import type { CommandPackage, CommandRewriter, RewrittenCommand } from '@/ontobdc/shared/domain/model/command-rewriter';

const CONTAINER_FLAG = '--container';

/** The folder the command runs in, which is the container when the command has no `--container`. */
const cwdOf = (command: RewrittenCommand): string => command.mount.cwd ?? command.mount.path;

/**
 * Moves the `--container` of an `ontobdc container` command into what `infobim project` reads:
 * nothing when the container is the folder it runs in, the folder to run in otherwise, and
 * `--project-path` for `--attach`, whose container is not a project of the root yet.
 */
function containerFlag(command: RewrittenCommand, argv: string[]): RewrittenCommand {
  const at = argv.indexOf(CONTAINER_FLAG);
  if (at < 0 || at === argv.length - 1) return { ...command, argv };
  const location = argv[at + 1];
  const rest = [...argv.slice(0, at), ...argv.slice(at + 2)];
  if (location === cwdOf(command)) return { ...command, argv: rest };
  if (rest.includes('--attach')) return { ...command, argv: [...rest.slice(0, at), '--project-path', location, ...rest.slice(at)] };
  return { argv: rest, mount: { ...command.mount, cwd: location } };
}

/** The program InfoBIM runs under, which a person may type as well. */
export const programs: string[] = ['infobim'];

/** The package the program is. */
export const packages: CommandPackage[] = [{ name: 'infobim', label: 'InfoBIM' }];

/** Every `ontobdc` command runs as `infobim`; `ontobdc container …` runs as `infobim project …`. */
export const rewrite: CommandRewriter['rewrite'] = (command) => {
  const [program, component, ...rest] = command.argv;
  if (program !== 'ontobdc') return command;
  if (component !== 'container') return { ...command, argv: ['infobim', component, ...rest].filter((part) => part !== undefined) };
  return containerFlag(command, ['infobim', 'project', ...rest]);
};
