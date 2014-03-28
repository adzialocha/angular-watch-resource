'use strict';

module.exports = function (grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.initConfig({

    npm: grunt.file.readJSON('package.json'),
    bower: grunt.file.readJSON('.bowerrc'),

    yeoman: {
      app: 'example',
      src: 'src',
      dist: 'dist',
      test: 'test'
    },

    watch: {

      server: {
        files: [
          '<%= yeoman.app %>/*.html',
          '<%= yeoman.app %>/scripts/{,*/}*.js',
          '<%= yeoman.src %>/{,*/}*.js',
          '<%= yeoman.test %>/*.js'
        ],
        tasks: ['jshint', 'test']
      }

    },

    connect: {
      options: {
        port: 9000,
        hostname: 'localhost'
      },
      watch: {
        options: {
          base: [
            '.tmp',
            '<%= yeoman.src %>',
            '<%= bower.directory %>',
            '<%= yeoman.app %>'
          ]
        }
      }
    },

    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            '.tmp',
            '<%= yeoman.dist %>/*',
            '!<%= yeoman.dist %>/.git*'
          ]
        }]
      },
      server: '.tmp'
    },

    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        'Gruntfile.js',
        '<%= yeoman.app %>/scripts/{,*/}*.js',
        '<%= yeoman.src %>/{,*/}*.js'
      ]
    },

    jasmine: {
      dist: {
        src: [
          '<%= bower.directory %>/angular/angular.js',
          '<%= bower.directory %>/angular-mocks/angular-mocks.js',
          '<%= bower.directory %>/jquery/jquery.js',
          '<%= yeoman.src %>/{,*/}*.js'
        ],
        options: {
          specs: '<%= yeoman.test %>/{,*/}*.js'
        }
      }
    },

    concat: {
      options: {
        separator: ';'
      },
      dist: {
        src: ['<%= yeoman.src %>/**/*.js'],
        dest: '<%= yeoman.dist %>/<%= npm.name %>.js'
      }
    },

    uglify: {
      options: {
        preserveComments: 'some',
        banner: '/*! <%= npm.name %>.js <%= grunt.template.today("dd-mm-yyyy") %> */\n'
      },
      minified: {
        options: {
          sourceMap: true,
          sourceMapName: '<%= yeoman.dist %>/<%= npm.name %>.min.map'
        },
        files: {
          '<%= yeoman.dist %>/<%= npm.name %>.min.js': ['<%= yeoman.dist %>/<%= npm.name %>.js']
        }
      },
      beautified: {
        options: {
          beautify: {
            width: 80,
            'indent_level': 2,
            beautify: true
          },
          mangle: false,
          compress: false
        },
        files: {
          '<%= yeoman.dist %>/<%= npm.name %>.js': ['<%= yeoman.dist %>/<%= npm.name %>.js']
        }
      }
    }
  });

  grunt.registerTask('serve', [
    'clean:server',
    'connect',
    'watch'
  ]);

  grunt.registerTask('test', [
    'jasmine'
  ]);

  grunt.registerTask('build', [
    'clean:dist',
    'concat',
    'uglify'
  ]);

  grunt.registerTask('default', [
    'jshint',
    'test',
    'build'
  ]);
};
