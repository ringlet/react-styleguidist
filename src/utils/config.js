var fs = require('fs');
var path = require('path');
var findup = require('findup');
var semverUtils = require('semver-utils');
var minimist = require('minimist');
var prettyjson = require('prettyjson');
var _ = require('lodash');
var utils = require('./server');

var CONFIG_FILENAME = 'styleguide.config.js';
var DEFAULT_CONFIG = {
	rootDir: null,
	components: null,
	skipComponentsWithoutExample: false,
	title: 'Style guide',
	styleguideDir: 'styleguide',
	template: path.join(__dirname, '../templates/index.html'),
	serverHost: 'localhost',
	serverPort: 3000,
	highlightTheme: 'base16-light',
	verbose: false,
	getExampleFilename: function(componentpath) {
		return path.join(path.dirname(componentpath), 'Readme.md');
	},
	getComponentPathLine: function(componentpath) {
		return componentpath;
	},
	updateWebpackConfig: null
};
var DEPENDENCIES = [
	{
		package: 'babel-core',
		name: 'Babel',
		from: 6,
		to: 6
	},
	{
		package: 'webpack',
		name: 'Webpack',
		from: 1,
		to: 1
	}
];
var BUGS_URL = 'https://github.com/sapegin/react-styleguidist/issues';

/**
 * Read, parse and validate config file.
 * @returns {Object}
 */
function readConfig() {
	var argv = minimist(process.argv.slice(2));
	var configFilepath = findConfig(argv);

	var options = require(configFilepath);

	validateConfig(options);

	var configDir = path.dirname(configFilepath);
	var rootDir = path.resolve(configDir, options.rootDir);

	validateDependencies(configDir);

	if (rootDir === configDir) {
		throw Error('Styleguidist: "rootDir" should not point to a folder with the Styleguidist config and node_modules folder');
	}
	if (!utils.isDirectoryExists(rootDir)) {
		throw Error('Styleguidist: "rootDir" directory not found: ' + rootDir);
	}

	options = _.merge({}, DEFAULT_CONFIG, options);
	options = _.merge({}, options, {
		verbose: !!argv.verbose,
		rootDir: rootDir,
		styleguideDir: path.resolve(configDir, options.styleguideDir)
	});

	if (options.verbose) {
		console.log();
		console.log('Using config file:', configFilepath);
		console.log(prettyjson.render(options));
		console.log();
	}

	return options;
}

/**
 * Find config file: use file specified in the command line or try to find up the file tree.
 *
 * @param {Object} argv CLI arguments
 * @return {string} Config file path.
 */
function findConfig(argv) {
	if (argv.config) {
		// Custom config location

		var configFilepath = path.join(process.cwd(), argv.config);
		if (!fs.existsSync(configFilepath)) {
			throw Error('Styleguidist config not found: ' + configFilepath + '.');
		}

		return configFilepath;
	}
	else {
		// Search config file in all parent directories

		var configDir;
		try {
			configDir = findup.sync(__dirname, CONFIG_FILENAME);
		}
		catch (e) {
			throw Error('Styleguidist config not found: ' + CONFIG_FILENAME + '.');
		}

		return path.join(configDir, CONFIG_FILENAME);
	}
}

/**
 * Validate config.
 *
 * @param {Object} options Config options.
 */
function validateConfig(options) {
	if (!options.rootDir) {
		throw Error('Styleguidist: "rootDir" option is required.');
	}
	if (!options.components) {
		throw Error('Styleguidist: "components" option is required.');
	}
	if (options.getExampleFilename && typeof options.getExampleFilename !== 'function') {
		throw Error('Styleguidist: "getExampleFilename" option must be a function.');
	}
	if (options.getComponentPathLine && typeof options.getComponentPathLine !== 'function') {
		throw Error('Styleguidist: "getComponentPathLine" option must be a function.');
	}
	if (options.updateWebpackConfig && typeof options.updateWebpackConfig !== 'function') {
		throw Error('Styleguidist: "updateWebpackConfig" option must be a function.');
	}
}

/**
 * Validate project’s Babel and Webpack versions.
 *
 * @param {string} configDir Config file directory.
 */
function validateDependencies(configDir) {
	var packageJsonPath = path.join(findup.sync(configDir, 'package.json'), 'package.json');
	var packageJson = require(packageJsonPath);
	DEPENDENCIES.forEach(validateDependency.bind(null, packageJson));
}

/**
 * Check versions of a project dependency.
 *
 * @param {Object} packageJson package.json.
 * @param {Object} dependency Dependency details.
 */
function validateDependency(packageJson, dependency) {
	var version = findDependency(dependency.package, packageJson);
	if (!version) {
		return;
	}

	var major;
	try {
		major = semverUtils.parseRange(version)[0].major;
	}
	catch (e) {
		console.log('Styleguidist: cannot parse ' + dependency.name + ' version which is "' + version + '".');
		console.log('Styleguidist might not work properly. Please report this issue at ' + BUGS_URL);
		console.log();
	}

	if (major < dependency.from) {
		throw Error('Styleguidist: ' + dependency.name + ' ' + dependency.from + ' is required, ' +
			'you are using version ' + major + '.');
	}
	else if (major > dependency.to) {
		console.log('Styleguidist: ' + dependency.name + ' is supported up to version ' + dependency.to + ', ' +
			'you are using version ' + major + '.');
		console.log('Styleguidist might not work properly, report bugs at ' + BUGS_URL);
		console.log();
	}
}

/**
 * Find package in project’s dependencies or devDependencies.
 *
 * @param {string} name Package name.
 * @param {Object} packageJson package.json.
 * @returns {string}
 */
function findDependency(name, packageJson) {
	if (packageJson.dependencies && packageJson.dependencies[name]) {
		return packageJson.dependencies[name];
	}
	if (packageJson.devDependencies && packageJson.devDependencies[name]) {
		return packageJson.devDependencies[name];
	}
	return null;
}

module.exports = readConfig();
