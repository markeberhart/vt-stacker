# vt-stacker
This application will build PBF files from unprojected (WGS84) shapefiles.

# vtstacker

### This application will build PBF files from unprojected (WGS84) shapefiles.

---

## Creating a MapStack


rgs
        .option('options', 'To be followed by the url to a JSON-formatted file with configuration options. (eg. --options/-o ./examples/example-options.json).')
        .option('devserver', 'To be followed by the url to a directory you wish to server via HTTP. The default port is 8500.  Additionally, you can define the directory in your options JSON. If the options JSON property `run-http-dev` is set to false, then the server will not run.')
        .option('examples', 'To be followed by the url to a directory you wish to have vtstacker example files copied to.')
        .option('buildmap', 'Include this argument to build a series of map vector tiles based on your chosen options.');

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


Open your GitBash (or other command line interpreter) and navigate to the root of your project where you included vtstacker as a requirement.

Ensure you have run `npm install`

In the command line, enter the following:

npm install -g git+ssh://git@

--link --global-style

`vtstacker -o default -b` OR `vtstacker --options default --buildmap`

If you wish to point to your own external option file (see formatting below), you can enter it as follows (let's assume your file is in .working/maps/style.json):

`vtstacker -o ./examples/options-example-simple.json -b` OR `vtstacker --options .working/maps/style.json --buildmap`

vtstacker -o ./examples/options-example-simple.json -b

---

## Defining your options

Below is an example of options. You can find this example in two places:
1. Inside the `package.json` file as `vtstacker-options`
2. As a separate JSON file here: `./examples/example-options.json`

---
````
{
    "minzoom":0,
    "maxzoom":6,
    "bbox":{
        "north":50,
        "east":50,
        "south":-10,
        "west":-30
    },
    "http-dev-server": {
        "http-dev-port": 8300,
        "run-http-dev": "true",
        "http-dev-dir": "./examples/www"
    },
    "example-files":{
        "duplicate-example-files":"true",
        "example-files-destination-dir":"./vtstacker-examples"
    },
    "folder-options": {
        "output-temp-files": "./examples/www/temp-files/",
        "output-pbf-files": "./examples/www/tiles/"
    },
    "sources": {

    }
}
````
---

`minzoom` represents the minimum zoom you wish to have in your map. In other words, what's the highest-up zoom level you plan to use? 0 is a view from space and 12 is street-level detail.

`minzoom` represents the maximum zoom you wish to have in your map. In other words, what's the lowest-to-the-ground zoom level you plan to use? 0 is a view from space and 12 is street-level detail.

`bbox` represents the bounding box to be used to cut-out your shapefiles. Your map will not include any data that is outside this bounding box.

`http-dev-server` is an object with some options for previewing your data in a pre-built html map

> `run-http-dev` is a boolean (true/false) that tells vtstacker whether to launch a web preview of your map data when it has finished compiling.

> `http-dev-dir` is the directory to serve to http://localhost:8000/index.html. You will want to have an `index.html` file here as well as all neccessary files. An example site (default) can be found here: `./examples/www`.

`folder-options` is an object to define the directory locations where vtstacker should save the PBF vector tiles.

> `output-temp-files` is where vtstacker will save any temporary geojson files it has to create when building your vector tile files.

> `output-pbf-files` is where vtstacker will save all of your vector tile files by zoom/y/x location.

`sources` is an object with unlimited objects that define the source shapefiles to be used.

> A source entry will have 5 mandatory entries:
>  1. name. The object will have a name without spaces or special characters. This name (eg. 'country-layers'), will be referenced later when applying colors and styles.
>  2. `sourceFileType` is the type of file being use. Currently the only supported source format is <i>shapefile</i>.
>  3. `url` is the relative link to the source file, for example: <i>./examples/shapefiles/shp_country_labels.shp</i>
>  4. `geom` tells vtstacker what type of geometry the shapefile is. The three supported types are <i>point, line, and polygon</i>.
>  5. `quality` denotes what amount of detail you want to see in the map. You can choose any value from `0%` to `100%`. The lower the percent, the lower the quality of that layer in the map. <i>This only works with line and polygon sources</i>.

---
