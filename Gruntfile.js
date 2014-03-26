'use strict';

module.exports = function (grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.initConfig({

    npm: grunt.file.readJSON('package.json'),

    yeoman: {
      app: 'example',
      src: 'src',
      dist: 'dist'
    },

    watch: {

      livereload: {
        options: {
          livereload: '<%= connect.options.livereload %>'
        },
        files: [
          '<%= yeoman.app %>/*.html',
          '{.tmp,<%= yeoman.app %>}/scripts/{,*/}*.js',
          '<%= yeoman.src %>}/{,*/}*.js',
          'test}/specs/*.js',
          '<%= yeoman.src %>}/{,*/}*.css'
        ]
      }

    },

    connect: {
      options: {
        port: 9000,
        livereload: 35729,
        hostname: 'localhost'
      },
      livereload: {
        options: {
          open: true,
          base: [
            '.tmp',
            '<%= yeoman.src %>',
            'bower_components',
            '<%= yeoman.app %>'
          ]
        }
      },
      test: {
        options: {
          base: [
            '.tmp',
            'test',
            '<%= yeoman.app %>',
            'bower_components',
            '<%= yeoman.app %>'
          ]
        }
      },
      dist: {
        options: {
          open: true,
          base: '<%= yeoman.dist %>',
          livereload: false
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
        '<%= yeoman.src %>/{,*/}*.js',
        'test/spec/{,*/}*.js'
      ]
    },

    karma: {
      options: {
        frameworks: [ 'jasmine' ],
        files: [
          'bower_components/angular/angular.js',
          'bower_components/angular-mocks/angular-mocks.js',
          'bower_components/jquery/jquery.js',
          '<%= yeoman.src %>/*.js',
          'test/specs/*.js'
        ],
        reporters: [ 'dots', 'progress' ],
        logColors: true,
        browsers: ['PhantomJS']
      },

      unit:
      {
        singleRun: true
      },

      live:
      {
        autoWatch: true,
        singleRun: false
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
        banner: '/*! <%= npm.name %>.min.js <%= grunt.template.today("dd-mm-yyyy") %> */\n'
      },
      dist: {
        files: {
          'dist/<%= npm.name %>.min.js': ['<%= concat.dist.dest %>']
        }
      }
    }
  });

  grunt.registerTask('serve', [
    'clean:server',
    'connect:livereload',
    'watch'
  ]);

  grunt.registerTask('test', [
    'clean:server',
    'connect:test',
    'karma:unit'
  ]);

  grunt.registerTask('test:live', [
    'clean:server',
    'connect:test',
    'karma:live'
  ]);

  grunt.registerTask('build', [
    'jshint',
    'test',
    'clean:dist',
    'concat',
    'uglify'
  ]);

  grunt.registerTask('default', [
    'build'
  ]);
};
