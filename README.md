# vt-stacker
This application will build PBF files from unprojected (WGS84) shapefiles.


### This application will build PBF files from unprojected (WGS84) shapefiles.

---

## Installing VT-STACKER

Open your GitBash (or other command line interpreter) and navigate to the root of your project where you included vtstacker as a requirement.

Ensure you have run `npm install -g --link --global-style`

In the command line, enter the following:

npm install -g --link --global-style

---

## Running Default Web Server

To run/test the default web service, type the following command:

`vtstacker --devserver ./examples/www` OR `vtstacker -d ./examples/www` 

Be sure to type in the location of the website you wish to serve via port 8500. To change the default port, you can go to the code and look for the following settings in index.js:

````
let devServerObj = {
    fromSystem:true,
    port: 8500, <-- change 8500 to a different number like 8800 or something else
    dir: null
}
````

Next, be sure to open your browser to port 8500 (default port for VT-STCKER) by going to http://localhost:8500

---

## Building PBF Tiles from JSON file

If you wish to point to your own external option file (see formatting below), you can enter it as follows (let's assume your file is in ./examples/options.json):

`vtstacker -o ./examples/options.json -b` OR `vtstacker --options ./examples/options.json --buildmap`

---

## Defining your options

Below is an example of an options JSON. You can an example here: 
`./examples/options.json`

---
````
{
	"minzoom":0,
	"maxzoom":4,
	"bbox":{
		"north":85,
		"east":180,
		"south":-85,
		"west":-180
    },
    "http-dev-server": {
        "http-dev-port": 8300,
        "run-http-dev": "true",
        "http-dev-dir": "./examples/www"
    },
    "folder-options": {
        "output-temp-files": "./examples/www/temp-files/",
        "output-pbf-files": "./examples/www/tiles/"
    },
    "sources": {
        "countries": {
            "sourceFileType": "shapefile",
            "url": "./examples/shapefiles/ne_10m_admin_0_countries_lakes.shp",
            "geom": "polygon",
            "quality": "75%"
        },
        "boundaries": {
            "sourceFileType": "shapefile",
            "url": "./examples/shapefiles/ne_10m_admin_0_boundary_lines_land.shp",
            "geom": "line",
            "quality": "90%"
        },
        "roads": {
            "sourceFileType": "shapefile",
            "url": "./examples/shapefiles/ne_10m_roads.shp",
            "geom": "line",
            "quality": "70%"
        },
        "places": {
            "sourceFileType": "shapefile",
            "url": "./examples/shapefiles/ne_10m_populated_places.shp",
            "geom": "point",
            "quality": "100%"
        }
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
>  1. The object will have a name without spaces or special characters. This name (eg. 'country-layers'), will be referenced later when applying colors and styles to the PBF layers from a Mapbox style sheet.
>  2. `sourceFileType` is the type of file being use. Currently the only supported source format is <i>shapefile</i>.
>  3. `url` is the relative link to the source file, for example: <i>./examples/shapefiles/shp_country_labels.shp</i>
>  4. `geom` tells vtstacker what type of geometry the shapefile is. The three supported types are <i>point, line, and polygon</i>.
>  5. `quality` denotes what amount of detail you want to see in the map. You can choose any value from `0%` to `100%`. The lower the percent, the lower the quality of that layer in the map. <i>This only works with line and polygon sources</i>.

---
