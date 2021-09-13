
const vscode = require(`vscode`);
const path = require(`path`);
const IBMi = require(`./IBMi`);
const IBMiContent = require(`./IBMiContent`);
const Configuration = require(`./Configuration`);

const CompileTools = require(`./CompileTools`);

let projectEnabled = false;

module.exports = class LocalProject {
  static async init() {
    if (LocalProject.hasWorkspace()) {
      const configExists = await LocalProject.configExists();

      if (configExists) {
        projectEnabled = true;
      } else {
        const isProject = await vscode.window.showInformationMessage(`Is this workspace an IBM i project?`, `Yes`, `No`);

        if (isProject === `Yes`) {
          projectEnabled = true;

          vscode.window.showInformationMessage(`No ibmi.json file found. Creating default configuration file.`);
          await LocalProject.createConfig();
        }
      }
    }
  }

  static hasWorkspace() {
    return vscode.workspace.workspaceFolders.length === 1;
  }

  static getWorkspaceFolder() {
    if (LocalProject.hasWorkspace()) {
      return vscode.workspace.workspaceFolders[0];
    }
  }

  static async configValid(config) {
    if (config.buildLibrary && config.actions && config.actions.length > 0) {
      return true;
    }

    return false;
  }

  static async configExists() {
    const workspace = LocalProject.getWorkspaceFolder();
    const folderUri = workspace.uri;
    const jsonUri = folderUri.with({ path: path.join(folderUri.path, `.vscode`, `ibmi.json`) });

    try {
      await vscode.workspace.fs.stat(jsonUri);
      return true;
    } catch (err) {
      return false;
    }
  }

  static async envExists() {
    const workspace = LocalProject.getWorkspaceFolder();
    const folderUri = workspace.uri;
    const envUri = folderUri.with({ path: path.join(folderUri.path, `.env`) });

    try {
      await vscode.workspace.fs.stat(envUri);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Before calling this, call hasWorkspace() first.
   * @returns {Promise<{
   *    buildLibrary: string, 
   *    actions: {name: string, command: string, fileSystem: "qsys"|"ifs", commandEnvironment: "qsys"}[]
   * }>}
   */
  static async getConfig() {
    const workspace = LocalProject.getWorkspaceFolder();
    const folderUri = workspace.uri;
    let readData, readStr;

    let config;

    if (await LocalProject.configExists()) {
    // First we get the json configuration for the local project
      const jsonUri = folderUri.with({ path: path.join(folderUri.path, `.vscode`, `ibmi.json`) });

      readData = await vscode.workspace.fs.readFile(jsonUri);
      readStr = Buffer.from(readData).toString(`utf8`);
      config = JSON.parse(readStr);
    }

    if (await this.envExists()) {

      // Then we get the local .env file
      const envUri = folderUri.with({ path: path.join(folderUri.path, `.env`) });
      readData = await vscode.workspace.fs.readFile(envUri);
      readStr = Buffer.from(readData).toString(`utf8`);

      const envLines = readStr.split(`\n`);

      // Parse out the fileSystem lines
      const env = {};
      envLines.forEach(line => {
        const [key, value] = line.split(`=`);
        env[key] = value;
      });

      // Then we replace the fileSystem variables in the config
      for (const key in config) {
        const value = config[key];
        if (env[value]) {
          config[key] = env[value];
        }
      }

    }

    return config;
  }

  static async createConfig() {
    const workspace = LocalProject.getWorkspaceFolder();
    const folderUri = workspace.uri;
    const jsonUri = folderUri.with({ path: path.join(folderUri.path, `.vscode`, `ibmi.json`) });

    const config = {
      buildLibrary: `DEVLIB`,
      actions: [
        {
          name: `CRTBNDRPG`,
          command: `CRTBNDRPG PGM(&BUILDLIB/&NAME) SRCFILE(&BUILDLIB/&FOLDER) SRCMBR(&NAME) OPTION(*EVENTF) DBGVIEW(*SOURCE)`,
          fileSystem: `qsys`,
          commandEnvironment: `qsys`,
        }
      ]
    };

    const jsonStr = JSON.stringify(config, null, 2);

    await vscode.workspace.fs.writeFile(jsonUri, Buffer.from(jsonStr, `utf8`));
  }

  /**
   * @param {*} instance 
   * @param {vscode.TextDocument} document 
   */
  static async RunAction(instance, document) {
    /** @type {IBMi} */
    const connection = instance.getConnection();

    /** @type {Configuration} */
    const config = instance.getConfig();

    if (projectEnabled) {
      const configExists = await LocalProject.configExists();

      if (configExists) {
        const projConfig = await LocalProject.getConfig();

        if (await LocalProject.configValid(projConfig)) {

          const chosenOptionName = await vscode.window.showQuickPick(projConfig.actions.map(action => action.name));

          if (chosenOptionName) {
            const action = projConfig.actions.find(action => action.name === chosenOptionName);

            // 1. We find all the possible deps in the active editor
            const fileList = await vscode.workspace.findFiles(`**/*.*`);

            const content = document.getText().toUpperCase();
        
            /** @type {vscode.Uri[]} */
            let allUploads = [document.uri];

            fileList.forEach(file => {
              const basename = path.parse(file.fsPath).name.toUpperCase();
              if (content.includes(basename)) {
                allUploads.push(file);
              }
            });

            // 2. We upload all the files

            try {
              switch (action.fileSystem) {
              case `qsys`:
                await LocalProject.uploadQsys(projConfig, allUploads, instance);
                break;
              }
            } catch (e) {
              vscode.window.showErrorMessage(`Failed to upload files to system.`);
            }

            // 3. We build the command and the library list

            const pathInfo = path.parse(document.uri.fsPath);
            const folder = path.basename(pathInfo.dir); //Get the parent directory name

            let command = action.command;

            command = command.replace(new RegExp(`&BUILDLIB`, `g`), projConfig.buildLibrary.toUpperCase());
            command = command.replace(new RegExp(`&FOLDER`, `g`), folder.toUpperCase());
            command = command.replace(new RegExp(`&NAME`, `g`), pathInfo.name.toUpperCase());
            command = command.replace(new RegExp(`&EXT`, `g`), pathInfo.ext);

            const compileInfo = {
              lib: projConfig.buildLibrary.toUpperCase(),
              object: pathInfo.name.toUpperCase(),
              localFiles: allUploads
            };

            let libl = config.libraryList.slice(0).reverse();

            libl = libl.map(library => {
            //We use this for special variables in the libl
              switch (library) {
              case `&BUILDLIB`: return projConfig.buildLibrary;
              case `&CURLIB`: return config.currentLibrary;
              default: return library;
              }
            });

            // 4. We run the command

            /** @type {any} */
            let commandResult;

            try {
              switch (action.commandEnvironment) {
              case `qsys`:
                command = `system ${Configuration.get(`logCompileOutput`) ? `` : `-s`} "${command}"`;
                commandResult = await connection.qshCommand([
                  `liblist -d ` + connection.defaultUserLibraries.join(` `),
                  `liblist -c ` + config.currentLibrary,
                  `liblist -a ` + libl.join(` `),
                  command,
                ], undefined, 1);
                break;
              
              default:
                vscode.window.showErrorMessage(`Unsupported command environment: ${action.commandEnvironment}`);
                return;
            
              }

              if (commandResult.code === 0 || commandResult.code === null) {
                vscode.window.showInformationMessage(`Action ${chosenOptionName} for ${compileInfo.lib}/${compileInfo.object} was successful.`);
                if (Configuration.get(`autoRefresh`)) vscode.commands.executeCommand(`code-for-ibmi.refreshObjectList`, compileInfo.lib);
                
              } else {
                vscode.window.showErrorMessage(`Action ${chosenOptionName} for ${compileInfo.lib}/${compileInfo.object} was not successful.`);
              }

            } catch (e) {
              vscode.window.showErrorMessage(`Action ${chosenOptionName} for ${compileInfo.lib}/${compileInfo.object} failed. (internal error).`);
            }


            if (command.includes(`*EVENTF`)) {
              CompileTools.refreshDiagnostics(instance, compileInfo);
            }
          }

        } else {
          vscode.window.showWarningMessage(`ibmi.json configuration is incorrect.`);
        }
        
      } else {
        vscode.window.showInformationMessage(`No ibmi.json file found. Would you like to create one?`, `Yes`).then(async result => {
          if (result === `Yes`) {
            await LocalProject.createConfig();
          }
        });
      }
    }
  }

  /**
   * Uploads a set of files to the IBM i to the qsys env
   * @param {{buildLibrary: string}} config
   * @param {vscode.Uri[]} files 
   * @param {*} instance 
   */
  static async uploadQsys(config, files, instance) {
    let creations = [];
    let uploads = [];

    /** @type {IBMi} */
    const connection = instance.getConnection();

    /** @type {IBMiContent} */
    const content = instance.getContent();

    const fs = vscode.workspace.fs;

    for (const file of files) {
      const pathInfo = path.parse(file.fsPath);
      const name = pathInfo.name; //Member name
      const folder = path.basename(pathInfo.dir); //Get the parent directory name
      const extension = pathInfo.ext;

      const bytes = await fs.readFile(file);

      creations.push(connection.paseCommand(`system -s "ADDPFM FILE(${config.buildLibrary}/${folder}) MBR(${name}) SRCTYPE(${extension})"`, undefined, 1));
      uploads.push(content.uploadMemberContent(undefined, config.buildLibrary, folder, name, Buffer.from(bytes).toString(`utf8`)));
    }

    await Promise.all(creations);
    await Promise.all(uploads);
  }
  
}