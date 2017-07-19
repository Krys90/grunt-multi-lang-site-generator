'use strict';

module.exports = function (grunt) {

    var _  = require('lodash'),
        fs = require('fs');

    grunt.registerMultiTask('atlas_watch_multi_lang', 'Create multiple translated sites based on templates and vocab json objects.', function () {

        var options = this.options({
                vocabs :            [],
                subdomain:          false,
                data:               {},
                output_directory:   '',
                sub_templates:      '',
                vocab_directory:    '',
                static_url: ''
            }),
            languages = get_list_of_languages(options.vocabs, options.vocab_directory),
            files     = this.files;

        validate_options(grunt, options, files);

        languages.forEach(function (lng) {
            files.forEach(function (f) {
                console.log(f);
                generate_output_file(grunt, lng, f, options);
            });
        });
    });

    function updateLodashTemplateTokenSettings (token) {
        if(typeof token.evaluate !== 'undefined') {
            _.templateSettings.evaluate = token.evaluate;
        }
        if(typeof token.interpolate !== 'undefined') {
            _.templateSettings.interpolate = token.interpolate;
        }
        if(typeof token.escape !== 'undefined') {
            _.templateSettings.escape = token.escape;
        }
    }

    function get_list_of_languages (vocabs, vocab_directory) {
        if (all_vocabs_should_be_processed(vocabs)) {
            return _.map(fs.readdirSync(vocab_directory), function (fileName) {
                return fileName.replace('.json', '');
            });
        }
        if (vocabs.length > 0) {
            return vocabs;
        }
        return [''];
    }

    function validate_options (grunt, options, files) {
        grunt.verbose.writeflags(options, 'Options');

        if (we_dont_have(options.templatetoken)) {
            grunt.log.writeln('Using default template token');
        } else {
            updateLodashTemplateTokenSettings(options.templatetoken);
        }

        if (we_dont_have(options.vocabs)) {
            grunt.log.warn('Cannot run without any vocabs defined.');
        }

        if (we_dont_have(files)) {
            grunt.log.warn('Destination not written because no source files were provided.');
        }

        add_forward_slash_to_end_of_dir_paths(options);
    }

    function generate_output_file (grunt, lng, f, options) {

        if (options.subdomain) {
            var cleanfolder = lng.split("-");
            var dest = options.output_directory + cleanfolder[0] + '/' + cleanfolder[1] + '/' + f.dest;
           
        } else {
            var dest = options.output_directory + '/' + lng + '/' + f.dest;
        }

            var special_variables = {
                vocab_dir: '',
                cdn_absolute_url : ''
            };

        var vocab_data = JSON.parse(grunt.file.read(options.vocab_directory + lng + '.json')),
            data = _.merge(options.data, vocab_data, special_variables),
            src  = _.template(
                grunt.file.read(f.src),
                data,
                define_the_imports_keyword(options, data, function () {
                    return define_the_imports_keyword(options, data);
                })
            )

        grunt.file.write(dest, src);
        grunt.log.writeln('File "' + dest + '" created.');
    }

    function all_vocabs_should_be_processed (vocabs) {
        return vocabs === '*' || vocabs[0] === '*';
    }

    function we_dont_have (object) {
        if(typeof object === 'undefined') {
            return true;
        }
        return object.length < 1;
    }

    function add_forward_slash_to_end_of_dir_paths (options) {
        options.vocab_directory    = do_the_forward_slash_adding(options.vocab_directory);
        options.output_directory   = do_the_forward_slash_adding(options.output_directory);
    }

    function do_the_forward_slash_adding (directory) {
        if (
            (directory !== '') &&
            (directory.substr(-1) !== '/')
        ) {
            directory += '/';
        }
        return directory;
    }

    function define_the_imports_keyword (options, data, callback) {
        callback = callback || function () {};
        return {
            'imports': {
                include: function (tmpl, params) {
                    params = params || {};
                    var include_data = _.merge(data, params);
                    return _.template(
                        fs.readFileSync(tmpl).toString(),
                        include_data,
                        callback()
                    );
                }
            }
        };
    }
};