/*jshint node: true */
'use strict';
module.exports = function(grunt) {

  var version = require("./package.json").version;

  grunt.initConfig({
    jshint: {
      options: grunt.file.readJSON('.jshintrc'),
      production: ['./lib/**/*.js'],
    },
    browserify: {
      all: {
        files: {
          'dist/jslha.js': ['lib/index.js']
        },
        options: {
          browserifyOptions: {
            standalone: 'JSLha',
            insertGlobalVars: {
              Buffer: undefined,
            },
            builtins: false
          }
        }
      }
    },
    "console-clean": {
      all: {
        files: [
          {src: ['dist/jslha.js'], dest: 'dist/jslha.js'}
        ]
      },
      options: {
        strategy: function(content) {
          return '';
        }
      }
    },
    uglify: {
      options: {
        mangle: true,
        preserveComments: false
      },
      all: {
        src: 'dist/jslha.js',
        dest: 'dist/jslha.min.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-console-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask("build", ["browserify", "console-clean", "uglify"]);
  grunt.registerTask("default", ["jshint", "build"]);
};
