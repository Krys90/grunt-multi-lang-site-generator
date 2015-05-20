'use strict';

module.exports = function (grunt) {

    var _          = require('lodash'),
        fs         = require('fs'),
        fileWalker = require('file');

    grunt.registerMultiTask('multi_lang_site_generator', 'Create multiple translated sites based on templates and vocab json objects.', function () {

        var options = this.options({
                vocabs :            [],
                data:               {},
                output_directory:   '',
                template_directory: '',
                sub_templates:      '',
                vocab_directory:    ''
            }),
            languages = get_list_of_languages(options.vocabs, options.vocab_directory),
            files     = this.files;

        validate_options(grunt, options, files);

        if (files.length === 0) {
            files = get_list_of_files(options);
        }

        languages.forEach(function (lng) {
            files.forEach(function (f) {
                generate_output_file(grunt, lng, f, options);
            });
        });
    });

    function get_list_of_languages (vocabs, vocab_directory) {
        var list_of_languages = [];
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

    function get_list_of_files(options) {
        var files = [],
            destination;

        var source      = options.template_directory,
            exclude     = options.exclude || [];

        fileWalker.walkSync(source, function (base, subdirectories, filenames) {
            var currentDir = base.replace(source, ''); // 'test/fixtures/source/more_source' => '/more_source'

            for (var i = 0; i < filenames.length; i++) {
                if (currentDir.length === 0) {
                    destination = filenames[i];
                }
                else {
                    destination = currentDir + '/' + filenames[i];
                }

                if (is_excluded(base + '/' + filenames[i], options)) {
                    grunt.log.writeln('Excluded file detected. Skipping processing ' + base + '/' + filenames[i]);
                }
                else {
                    // this strange object formation is identical to what Grunt creates when someone passes
                    // `files` rather than `source`. It does seem strange, and should probably be looked at. @TODO.
                    files.push({
                        dest: destination,
                        orig: {
                            src:  [
                                currentDir + '/' + filenames[i]
                            ],
                            dest: destination
                        }
                    });
                }
            }
        });

        console.log(files);

        return files;
    }

    function is_excluded(sourceFile, options) {
        for (var i = 0; i < options.exclude.length; i++) {
            var tmp = sourceFile.replace(options.exclude[i], '');
            if (tmp !== sourceFile) {
                return true;
            }
        }
        return false;
    }

    function validate_options (grunt, options, files) {
        grunt.verbose.writeflags(options, 'Options');

        if (we_dont_have(options.vocabs)) {
            grunt.log.warn('Cannot run without any vocabs defined.');
        }

        if (we_dont_have(options.template_directory) && we_dont_have(files)) {
            grunt.log.warn('You need to provide either: a) a list of files, OR b) a template directory (which will then process all files in that directory).');
        }

        add_forward_slash_to_end_of_dir_paths(options);
    }

    function generate_output_file (grunt, lng, f, options) {

        var dest = options.output_directory + lng + '/' + f.dest;

        var fileName    = f.orig.src[0],
            fileType    = fileName.split('.').pop(),
            fixedAssets = options.copy_cleanly || [];

        for (var i = 0; i < fixedAssets.length; i++) {
            if (fixedAssets[i] === fileType) {
                grunt.file.write(dest, fs.readFileSync(options.template_directory + fileName));
                return true;
            }
        }

        var vocab_data = JSON.parse(grunt.file.read(options.vocab_directory + lng + '.json')),
            special_variables = {
                vocab_dir: lng
            },
            parsed_vocab_data = replace_bb_code_with_markup_in(vocab_data),
            data = _.merge(options.data, parsed_vocab_data, special_variables),
            src  = _.template(
                grunt.file.read(options.template_directory + fileName),
                data,
                define_the_imports_keyword(options, data, function () {
                    return define_the_imports_keyword(options, data);
                })
            );

        grunt.file.write(dest, src);
        grunt.log.writeln('File "' + dest + '" created.');
    }

    function all_vocabs_should_be_processed (vocabs) {
        return vocabs === '*' || vocabs[0] === '*';
    }

    function we_dont_have (object) {
        return typeof object === 'undefined' || object.length < 1;
    }

    function we_have(object) {
        return !we_dont_have(object);
    }

    function add_forward_slash_to_end_of_dir_paths (options) {
        options.template_directory = do_the_forward_slash_adding(options.template_directory);
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

    function replace_bb_code_with_markup_in (vocabs_data){
        var parsed_vocabs = vocabs_data,
            vocab;

        for (vocab in vocabs_data) {
            parsed_vocabs[vocab] = parse_vocab_item(parsed_vocabs[vocab]);
        }

        return parsed_vocabs;
    }

    function parse_vocab_item (vocabItem) {
        /* Replaces {B} and {/B} with <strong> and </strong> */
        vocabItem = vocabItem.replace(/\{B\}/gi, '<strong>').replace(/\{\/B\}/gi, '</strong>');

        /* Replaces {P} and {/P} with <p> and </p> */
        vocabItem = vocabItem.replace(/\{P\}/gi, '<p>').replace(/\{\/P\}/gi, '</p>');

        /* matchs {URL=X}Y{/URL} to generate a href tag */
        var urlArray = vocabItem.match(/\{URL=(.*)\}(.*)\{\/URL\}/i);
        if (urlArray !== null){
            var hrefTag = '<a href="' + urlArray[1] + '" target="_top">' + urlArray[2] + '</a>';
            vocabItem = vocabItem.replace(urlArray[0], hrefTag);
        }

        return vocabItem;
    }

    function define_the_imports_keyword (options, data, callback) {
        callback = callback || function () {};
        return {
            'imports': {
                include: function (tmpl, params) {
                    params = params || {};
                    var include_data = _.merge(data, params);
                    return _.template(
                        fs.readFileSync(options.template_directory + tmpl).toString(),
                        include_data,
                        callback()
                    );
                }
            }
        };
    }
};