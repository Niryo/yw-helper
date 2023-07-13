import {createCommand} from 'commander';
import {execSync} from 'child_process';
import Fuse from 'fuse.js';
import inquirer from 'inquirer';
import fs from 'fs';
import inquirerPrompt from 'inquirer-autocomplete-prompt';

inquirer.registerPrompt('autocomplete', inquirerPrompt);

const yarnWorkspaceRun = createCommand();
yarnWorkspaceRun
  .argument('[workspaceName]', 'The name of the workspace')
  .argument('[command]', 'The command to run')
  .action(async (workspaceNameInput: string, commandInput: string) => {

    const allWorkspaces = execSync('yarn workspaces list --json', {stdio: 'pipe'}).toString()
      .split('\n')
      .filter(line => line !== '')
      .map((line) => JSON.parse(line))
      .reduce((acc, {location, name}) => {
        acc[name] = location;
        return acc;
      }, {} as {location: string; name: string}[]);
    const workspacesName = Object.keys(allWorkspaces);
    const fuseWorkspaceNames = new Fuse(workspacesName, {ignoreLocation: true});
    const workspaceName = workspaceNameInput ? fuseWorkspaceNames.search(workspaceNameInput)[0].item : (await inquirer
      .prompt([
        {
          type: 'autocomplete',
          name: 'workspaceName',
          message: 'Workspace',
          source: (_answersSoFar: any, input: string) => {
            if (!input) {
              return workspacesName;
            }
            return fuseWorkspaceNames.search(input).map(({item}) => item);
          },
        },
      ])).workspaceName;

    const workspaceScripts = Object.keys(JSON.parse(fs.readFileSync(`${allWorkspaces[workspaceName]}/package.json`, 'utf-8')).scripts);
    workspaceScripts.unshift('run');
    const fuseWorkspaceScripts = new Fuse(workspaceScripts, {ignoreLocation: true});

    const command = commandInput ?? (await inquirer
      .prompt([
        {
          type: 'autocomplete',
          name: 'command',
          message: 'Command',
          source: (_answersSoFar: any, input: string) => {
            if (!input) {
              return workspaceScripts;
            }
            return fuseWorkspaceScripts.search(input).map(({item}) => item);
          },
        },
      ])).command;
    const finalCommand = command !== 'run' ? command : (await inquirer.prompt({
      message: 'Run:',
      type: 'input',
      name: 'commandToRun',
    })).commandToRun;

    execSync(`yarn workspace ${workspaceName} ${finalCommand}`, {stdio: 'inherit'});
  });
yarnWorkspaceRun.parse(process.argv);
