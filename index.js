module.exports = () => {

    const path          = require('path');
    const fs            = require('fs');
    const mapshaper     = require('mapshaper');
    const shell         = require('shelljs');
    const pkgjson       = require('./package.json');
    const geojsonvt     = require('geojson-vt');
    const args          = require('args');
    const vtpbf         = require('vt-pbf');
    const open          = require('open');

    let isglobal      = false;

    const [,, ...msArgs] = process.argv
    let argsSent = false;
    if(msArgs.length>0) {
        argsSent = true;
    }

    // Object for passed arguments
    let vtstackerOptions = {created:false};

    // Object to track requirements for development http server preview
    let devServerObj = {
        fromSystem:true,
        port: 8500,
        dir: null
    }

    // Parameters for examples requests
    let examplesObj = {
        doCopyFiles:false,
        fromSystem: true,
        remdir: 'examples',
        dir: './vtstacker-examples'
    }


    // Help file oparameters
    args
        .option('options', 'To be followed by the url to a JSON-formatted file with configuration options. (eg. --options/-o ./examples/example-options.json).')
        .option('devserver', 'To be followed by the url to a directory you wish to server via HTTP. The default port is 8500.  Additionally, you can define the directory in your options JSON. If the options JSON property `run-http-dev` is set to false, then the server will not run.')
        .option('examples', 'To be followed by the url to a directory you wish to have vtstacker example files copied to.')
        .option('buildmap', 'Include this argument to build a series of map vector tiles based on your chosen options.');

    // Help file example snippets
    args.examples([
        {
            usage:'vtstacker -o ./examples/example-options.json -b -d',
            description:'Will create a new series of map tiles according to the instructions provided in the JSON. The `-b` command tells vtstacker to build the map and the `-d` command says to launch (or try to launch) a development browser preview.'
        },
        {
            usage:'vtstacker -d ./examples/www',
            description:'The `-d` command instructs vtstacker to preview the provided url in the default web browser. The default port is '+ devServerObj.port +'. In this example, you would visit the site by going to http://localhost:'+ devServerObj.port +'/'
        },
        {
            usage:'vtstacker -e ./examples',
            description:'The `-e` command instructs vtstacker to place a copy of the vtstacker example files to the provided directory. If no directory is provided, a new one will be created to copy the exmaple files to called `vtstacker-examples`'
        }
    ]);

    // Container to hold passed command line parameters
    const flags = args.parse(process.argv);


    // Create array of directories from string
    const getFoldersArray = (folder) => {
        const patharr = folder.split('/').filter(function(d,i,e) {
            return ((d!='') && (d!='.'));
        });
        return patharr;
    }

    // Delete a directory and all sub-directories in it
    const deleteFolderRecursive = function(path) {
        if (fs.existsSync(path)) {
          fs.readdirSync(path).forEach(function(file, index){
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse TODO todo to do 9/23/2019 - fix issue when running script from command line inside a project
              deleteFolderRecursive(curPath);
            } else { // delete file
              fs.unlinkSync(curPath);
            }
          });
          fs.rmdirSync(path);
        }
    };

    // Check multiple folders
    const checkOrCreateFolders = (options) => {
        for(var f in options['folder-options']) {
            console.log("\n Creating (or re-creating) the following directory:", options['folder-options'][f]);
            checkOrCreateFolder(options['folder-options'][f]);
        }
        return true;
    }

    // Create folders if they don't exist
    const checkOrCreateFolder = (folder) => {
        const patharr = getFoldersArray(folder);
        let cpath='';
        for(let f=0; f<patharr.length; f++) {
            if(patharr[f]=='..'){
                cpath = cpath + patharr[f] + '/' + patharr[f+1] + '/';
                f++;
            }else{
                cpath = cpath + patharr[f] + '/';
            }
            // If directory does not exist, create it
            if(!fs.existsSync(cpath)){
                fs.mkdirSync(cpath);
            }
        }
    }


    // get bounding box that is in West, South, East, North order
    const getBBoxWSEN = () => {
        let str = vtstackerOptions.bbox.west+','+vtstackerOptions.bbox.south+','+vtstackerOptions.bbox.east+','+vtstackerOptions.bbox.north;
        let arr = [Number(vtstackerOptions.bbox.west), Number(vtstackerOptions.bbox.south), Number(vtstackerOptions.bbox.east), Number(vtstackerOptions.bbox.north)]
        let obj = {
            str: str,
            arr: arr
        }
        return obj;
    }

    // get bounding box in South, West, North, East order
    const getBBoxSWNE = () => {
        let str = vtstackerOptions.bbox.south+','+vtstackerOptions.bbox.west+','+vtstackerOptions.bbox.north+','+vtstackerOptions.bbox.east;
        let arr = [Number(vtstackerOptions.bbox.south), Number(vtstackerOptions.bbox.west), Number(vtstackerOptions.bbox.north), Number(vtstackerOptions.bbox.east)]
        let obj = {
            str: str,
            arr: arr
        }
        return obj;
    }

    // Create source urls array for temp files to be made
    const getSources = () => {
        let cnt = 0;
        for(let s in vtstackerOptions.sources){
            if(vtstackerOptions.sources[s].sourceFileType){
                if(vtstackerOptions.sources[s].sourceFileType=="geojson" || vtstackerOptions.sources[s].sourceFileType=="shapefile"){
                    cnt++;
                    vtstackerOptions.sources[s].id = s;
                    vtstackerOptions.sources[s].uid = cnt;
                    vtstackerOptions.sources[s]['temp'] = vtstackerOptions['folder-options']['output-temp-files'] + s + ".geojson";
                    vtstackerOptions.sources[s].bbox = getBBoxWSEN().str;
                }
            }
        }
        vtstackerOptions['numSources'] = cnt;
        for(let sr in vtstackerOptions.sources){
            vtstackerOptions.sources[sr]['numSources'] = cnt;
        }
        vtstackerOptions.sources = createTempGeojsonFileCommands(vtstackerOptions.sources);
        return vtstackerOptions.sources;
    }

    // Create commands for mapshaper to build temporary geojson files
    const createTempGeojsonFileCommands = (sources) => {
        for(let s in sources) {
            if(!fs.existsSync(sources[s].url)) {
                console.log("Could not find:", sources[s].url);
                //sources[s].url = './node_modules/vtstacker/'+sources[s].url;
                isglobal = true;
                //console.log("PROCESS:", process.argv0);
                let urlArr = sources[s].url.split('/');
                let newUrl1 = urlArr.join('\\');
                    newUrl1 = newUrl1.replace('.\\','node_modules\\vtstacker\\');
                let newUrl2 = process.argv0.replace('node.exe',newUrl1);

                sources[s].url = newUrl2;
                console.log("Trying this instead!", sources[s].url);
            }
            let _cmd = null;
            if(sources[s].geom=="point"){
                _cmd = "-i "+sources[s].url+" -proj +proj=longlat +datum=WGS84 +no_defs -clip bbox="+sources[s].bbox+" -rename-layers "+sources[s].id+" -o "+sources[s].temp+" format=geojson";
            }else{
                _cmd = "-i "+sources[s].url+" -proj +proj=longlat +datum=WGS84 +no_defs -simplify dp "+sources[s].quality+" -clip bbox="+sources[s].bbox+" -rename-layers "+sources[s].id+" -o "+sources[s].temp+" format=geojson";
            }
            sources[s]['createGeojsonCmd'] = _cmd;
        }
        return sources;
    }

    const checkForFileExistance = (url) => {
        return fs.existsSync(path.resolve(url));
    }

    const tempJsonCallbackFailure = (error) => {
        console.log("tempJsonCallbackFailure:", error);
    }

    // Execute commands to create temporary geojson files
    const buildTempJsons = (sources) => {
        let lcnt = 0;
        console.log("Standby while I build new map tiles. This could take a few minutes...");
        for(let s in sources) {
            if(sources[s]['createGeojsonCmd'] != null && sources[s]['createGeojsonCmd'] != ""){
                //console.log("Working on GEOJSON for:", s);
                mapshaper.runCommands(sources[s]['createGeojsonCmd']).then(function(resolve, reject){
                    sources[s]['tempFileCreated'] = checkForFileExistance(sources[s].temp);
                    lcnt++;
                    //console.log(sources[s]['uid'], sources[s]['numSources'], lcnt);
                    if(lcnt==sources[s]['numSources']){
                        console.log("Now check for temp files in directory.");
                        checkForTempFiles(sources);
                    }
                     if(reject){
                         console.log("REJECTED!!", s);
                     }
                });
            }
        }
    }

    // Build Mapbox Vector Tile indexes
    const buildTempMVTs = (sources) => {
        //console.log("SOURCES TO BUILD MVT:", sources);
        for(let s in sources) {
            if(sources[s]['createGeojsonCmd'] != null && sources[s]['createGeojsonCmd'] != ""){
                sources[s]['mvt'] = geojsonvt(JSON.parse(fs.readFileSync(sources[s].temp, "utf8")));
            }
        }
        return sources;
    }

    // Create options object for vtpbf library
    const buildPBFvtstackerOptions = (sources) => {
        let layers = {};
        for(let s in sources) {
            layers[s] = sources[s]['mvt'];
        }
        let opts = {
            layers: layers,
            rootDir: vtstackerOptions['folder-options']['output-pbf-files'],
            bbox: getBBoxSWNE().arr,
            zoom: {
                min: Number(vtstackerOptions.minzoom),
                max: Number(vtstackerOptions.maxzoom)
            }
        }
        vtstackerOptions['pbf-vtstackerOptions'] = opts;
        return opts;
    }

    // Helper function to get individual PBF tile
    const getTile = (z, x, y, options) => {
        console.log("options:", options);
        var pbfOptions = {};
        var hasTiles = false;
        for(var lay in options.layers) {
            var tile = options.layers[lay].getTile(z, x, y);
            if (tile != null) {
                hasTiles = true;
                pbfOptions[lay] = tile;
            }
        }
        if(hasTiles) {
            var pbf = vtpbf.fromGeojsonVt(pbfOptions, {version: 2});
            //console.log("PBF:", pbf);
            //console.log("pbfOptions:", pbfOptions);
            return pbf;
        }
        return null;
    };

    // Series of helper functions
    const helpers = {
        //given a bounding box and zoom level, calculate x and y tile ranges
        getTileBounds(bbox, zoom) {
            var tileBounds = {
              xMin: this.long2tile(bbox[1], zoom),
              xMax: this.long2tile(bbox[3], zoom),
              yMin: this.lat2tile(bbox[2], zoom),
              yMax: this.lat2tile(bbox[0], zoom),
            };
            return tileBounds;
        },

        //lookup tile name based on lat/lon, courtesy of http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Lon..2Flat._to_tile_numbers
        long2tile(lon,zoom) {
          return (Math.floor((lon+180)/360*Math.pow(2,zoom)));
        },

        lat2tile(lat,zoom) {
          return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom)));
        },
    };

    // Create PBF directories and files by z/x/y
    const buildPBFTiles = (options) => {
        //console.log("PBF OPTIONS: ", options);
        let tileCount = 0, tileCoords = {}, tileBounds;

        let root = `${options.rootDir}`;
        if(fs.existsSync(root)){
            console.log("Root directory exists:", root);
            deleteFolderRecursive(root);
            fs.mkdirSync(root);
        }

        for(let z=options.zoom.min; z<=options.zoom.max; z++) {
            console.log("Zoom:", z);

            if(z==options.zoom.max){
                console.log("FINISHED");
                checkHttpDevServer();
            }

            let zPath = `${options.rootDir}/${z.toString()}/`;
            if(!fs.existsSync(zPath)){
                fs.mkdirSync(zPath);
            }

            tileBounds = helpers.getTileBounds(options.bbox, z);

            // x loop
            for(let x=tileBounds.xMin; x<=tileBounds.xMax; x++) {
                // create x directory in the z directory
                let xPath = zPath + x.toString();
                if(!fs.existsSync(xPath)){
                    fs.mkdirSync(xPath);
                }

                // y loop
                for(let y=tileBounds.yMin; y<=tileBounds.yMax; y++) {

                    //console.log(`Getting tile ${z} ${x} ${y} `)
                    let mvt = getTile(z, x, y, options);

                    // TODO what should be written to the tile if there is no data?
                    let output = mvt !== null ? mvt : '';
                    console.log("OUTPUT:", output);
                    fs.writeFileSync(`${xPath}/${y}.pbf`, output);
                    tileCount++;
                }

            }
        }

    }

    // Was "buildmap" parameter passed?
    const shouldBuildMap = () => {
        let buildmap = false;
        if(flags['buildmap']){
            buildmap = true;
        }
        return buildmap;
    }

    // Was "devserver" parameter passed?
    const canStartDevServer = () => {
        let runServer = false;
        if(flags['devserver'] && typeof flags['devserver']=='string'){
            devServerObj.dir = flags['devserver'];
            runServer = true;
        }
        return runServer;
    }

    // Decide whether to use options in command line parameter or options JSON
    const checkForExamplesRequest = () => {
        let cliDir = null;
        // Was a durectory url passed with "examples" command via CLI?
        if(flags['examples'] && typeof flags['examples']=='string'){
            cliDir = flags['examples'];
            examplesObj.dir = flags['examples'];
            examplesObj.doCopyFiles = true;
        }

        if(flags['examples'] && typeof flags['examples']=='boolean'){
            examplesObj.doCopyFiles =flags['examples'];
        }

        // If options JSON file provided, try to use its examples settings
        if(vtstackerOptions['example-files']
            && vtstackerOptions['example-files']['duplicate-example-files']
            && vtstackerOptions['example-files']['example-files-destination-dir']
        ){
            if(cliDir){
                vtstackerOptions['example-files']['example-files-destination-dir'] = cliDir;
            }

            flags['examples'] = vtstackerOptions['example-files']['example-files-destination-dir'];
            flags['e'] = flags['examples'];

            examplesObj.doCopyFiles = vtstackerOptions['example-files']['duplicate-example-files'];
            examplesObj.fromSystem = false;
            examplesObj.dir = vtstackerOptions['example-files']['example-files-destination-dir'];
        }

        return examplesObj.doCopyFiles;
    }

    // Copy example files from vtstacker/examples module directory to user local directory
    const copyOverExampleFiles = () => {
        let remDirectory = process.argv0.replace('node.exe','node_modules\\vtstacker\\'+examplesObj.remdir+'\\');
        let locDirectory = path.resolve(examplesObj.dir);
        checkOrCreateFolder(locDirectory);
        console.log(" Copying vtstacker example files from "+remDirectory+" to "+locDirectory+".");
        copyFolderRecursiveSync(remDirectory, locDirectory);
    }


    // Parse options JSON
    const getvtstackerOptions = () => {
        if(!vtstackerOptions.created && hasOptions()) {
            console.log("\n vtstacker now trying to pull options from this JSON file:", flags['options']);
            console.log("\n -----------------------------------------------------");
            let options = flags['options'];
            let jsonFile = flags['options'];
            if(!fs.existsSync(jsonFile)) {
                console.log("The JSON options file "+ jsonFile + " that you entered does not appear to exist.");
                console.log("\n -----------------------------------------------------");
            } else {
                filecontents = fs.readFileSync(flags['options']);
                vtstackerOptions = JSON.parse(filecontents);
                if(vtstackerOptions['folder-options'] && vtstackerOptions['folder-options']['output-temp-files']) {
                    vtstackerOptions['sources'] = getSources();
                }else{
                    console.log("\n Please double-check your JSON options file to ensure it has a `folder-options` property");
                    console.log("\n The `folder-options` property should have two sub-properties: `output-temp-files` and `output-pbf-files` which are both url strings pointing to directories for your temp GEOJSON files and PBF tiles for your map.");
                    console.log("\n -----------------------------------------------------");
                    vtstackerOptions.created = false;
                    return vtstackerOptions;
                }
                if(vtstackerOptions['http-dev-server']
                    && vtstackerOptions['http-dev-server']['run-http-dev']
                    && vtstackerOptions['http-dev-server']['run-http-dev']==='true'
                    && vtstackerOptions['http-dev-server']['http-dev-dir']
                    && vtstackerOptions['http-dev-server']['http-dev-port']
                    ){
                    if(!canStartDevServer()) {
                        flags['devserver'] = vtstackerOptions['http-dev-server']['http-dev-dir'];
                        flags['d'] = flags['devserver'];

                        devServerObj.port = vtstackerOptions['http-dev-server']['http-dev-port'];
                        devServerObj.dir = vtstackerOptions['http-dev-server']['http-dev-dir'];
                        devServerObj.fromSystem = false;
                        console.log("\n Found dev server directory and port in your options file. Port: " + devServerObj.port + ", directory: " + devServerObj.dir);
                    }

                }else{
                    flags['devserver'] = false;
                    flags['d'] = false;
                    console.log("\n HTTP Development server options not found.");
                    console.log("\n If you wish to utilize vtstacker's http development server preview, please double-check your JSON options file to ensure it has a `http-dev-server` property");
                    console.log("\n The `http-dev-server` property should have three sub-properties: `http-dev-port` (a 4-digit integer like 8888), `run-http-dev` (boolean of true of false) and `http-dev-dir` (a url string pointing to directory to display in browser at http://localhost:8888, or whatever port number you used).");
                    console.log("\n -----------------------------------------------------");
                }
                vtstackerOptions.created = true;
            }
        }
        return vtstackerOptions;
    }

    const hasOptions = () => {
        let hasOptions = false;
        if(flags['options'] && typeof flags['options']=='string'){
            hasOptions = true;
        }
        if(flags['options'] && typeof flags['options']=='boolean'){
            console.log("P\n lease be sure to include the url of a properly formatted JSON file after -o or --options. Example: -o ./workingfiles/myvtstackerfile.json");
            console.log("\n -----------------------------------------------------");
        }
        return hasOptions;
    }

    const init = () => {

        let options = getvtstackerOptions();

        if(options.created) {
            if(shouldBuildMap()){
                if(checkOrCreateFolders(options)) {
                    console.log("Build temp files...");
                    buildTempJsons(options.sources);
                }
            }else{
                console.log("\n Did not include --buildmap or -b argument, so will not build new map tiles.");
                checkHttpDevServer();
            }
        }else{
            console.log("\n Could not continue with map creation process due to an issue with the options JSON.");
            checkHttpDevServer();
        }

        //copyOverExampleFiles
        if(checkForExamplesRequest()!=false && checkForExamplesRequest()!='false') {
            copyOverExampleFiles();
        }
    }

    const checkForTempFiles = (sources) => {
        console.log("CHECK FOR TEMP FILES...");
        let obj= {};
        for(let src in sources){
            if(sources[src].tempFileCreated) {
                obj[src] = sources[src];
            }
        }
        let pbfvtstackerOptions = buildPBFvtstackerOptions( buildTempMVTs(obj) );
        buildPBFTiles(pbfvtstackerOptions);
    }

    const launchHttpDevServer = (args) => {
        let serveStatic     = require('serve-static');
        let http            = require('http');
        let finalhandler    = require('finalhandler');
        let webUrl          = args.dir;
        let devport         = args.port;

        if(isglobal) {
            let urlArr      = webUrl.split('/');
            let newUrl1     = urlArr.join('\\');
                newUrl1     = newUrl1.replace('.\\','node_modules\\vtstacker\\');
            let newUrl2     = process.argv0.replace('node.exe',newUrl1);
                webUrl      = newUrl2;
        }

        console.log("\n Starting development HTTP server here:", args.dir, " on port: ", args.port);

        console.log("\n Trying to host this:", webUrl);
        //works: 'd:\\turbine_suite\\node\\node_modules\\vtstacker\\examples\\www'

        let serve = serveStatic(webUrl, {
            'index': ['index.html']
        });
        let server = http.createServer(function onRequest(req, res){
            serve(req,res, finalhandler(req, res));
        })
        server.listen(devport);
        (async () => {
            await open('http://localhost:'+devport+'/');
        })();

        console.log('\n Server running on port '+ devport + ' is up now and pointing to ' + webUrl);
        console.log('\n Hit "Ctrl + C" to shut-down the dev server preview. (may need to do this multiple times)');
    }

    const checkHttpDevServer = () => {
        console.log("\n Looking to see if you requested a development HTTP preview...");
        if(canStartDevServer()) {
            if(devServerObj.fromSystem) {
                console.log("\n Request detected for development HTTP server preview. In other words, you included a --devserver or -d argument");
            }else{
                console.log("\n Request detected for development HTTP server preview. In other words, you included parameters in your options JSON file.");
            }

            launchHttpDevServer(devServerObj);
        }else{
            console.log("\n No directory was provided for the development server or `run-http-dev` is set to false in your options JSON file.");
        }
    }

    const copyFileSync = (source, target) => {

        var targetFile = target;

        //if target is a directory a new file with the same name will be created
        if ( fs.existsSync( target ) ) {
            if ( fs.lstatSync( target ).isDirectory() ) {
                targetFile = path.join( target, path.basename( source ) );
            }
        }

        fs.writeFileSync(targetFile, fs.readFileSync(source));
    }

    const copyFolderRecursiveSync = (source, target) => {
        var files = [];

        //check if folder needs to be created or integrated
        var targetFolder = path.join( target, path.basename( source ) );
        if ( !fs.existsSync( targetFolder ) ) {
            fs.mkdirSync( targetFolder );
        }

        //copy
        if ( fs.lstatSync( source ).isDirectory() ) {
            files = fs.readdirSync( source );
            files.forEach( function ( file ) {
                var curSource = path.join( source, file );
                if ( fs.lstatSync( curSource ).isDirectory() ) {
                    copyFolderRecursiveSync( curSource, targetFolder );
                } else {
                    copyFileSync( curSource, targetFolder );
                }
            } );
        }
    }


    console.log("   ******************************************");
    console.log("   **     Thanks for using vtstacker!     **");
    console.log("   **            version 0.0.1             **");
    console.log("   ******************************************");

    if(argsSent) {
        init();
    } else {
        console.log("\n   Hey there! I didn't detect any passed parameters. Below is a quick run-down of what vtstacker can do. \n ");
        args.showHelp();
    }

}
