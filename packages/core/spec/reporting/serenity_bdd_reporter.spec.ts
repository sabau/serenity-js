import * as fs from 'fs';
import * as mockfs from 'mock-fs';
import {
    ActivityFinished,
    ActivityStarts,
    DomainEvent,
    Outcome,
    Photo,
    PhotoAttempted,
    PhotoReceipt,
    RecordedActivity,
    RecordedScene,
    Result,
    SceneFinished,
    SceneStarts,
    SceneTagged,
    Tag,
} from '../../src/domain';
import { FileSystem } from '../../src/io/file_system';
import { Journal, Stage, StageManager } from '../../src/stage';

import { SerenityBDDReporter, serenityBDDReporter } from '../../src/reporting/serenity_bdd_reporter';

import expect = require('../expect');

describe('When reporting on what happened during the rehearsal', () => {

    describe ('SerenityBDDReporter', () => {

        // todo: extract hash generation so that it doesn't have to be hard-coded

        const
            startTime = 1467201010000,
            duration  = 42,
            rootDir   = `/path/to/project`,
            requirementsDir = `${rootDir}/features`,
            outputDir       = `${rootDir}/target/site/serenity`,

            scene     = new RecordedScene('Paying with a default card', 'Checkout', { path: `${requirementsDir}/checkout.feature` });

        let stageManager: StageManager,
            stage: Stage,
            fileSystem: FileSystem,
            reporter: SerenityBDDReporter;

        beforeEach(() => {
            fileSystem   = new FileSystem(outputDir);
            stageManager = new StageManager(new Journal());
            stage        = new Stage(stageManager);

            reporter = new SerenityBDDReporter(requirementsDir, fileSystem);
            reporter.assignTo(stage);
        });

        beforeEach(() => mockfs({ '/Users/jan/projects/serenityjs': {} }));
        afterEach (() => mockfs.restore());

        it ('can be instantiated using a default path to the reports directory', () => {
            expect(serenityBDDReporter()).to.be.instanceOf(SerenityBDDReporter);
        });

        it ('can be instantiated using a factory method so that explicit instantiation of the File System can be avoided', () => {
            expect(serenityBDDReporter('/some/path/to/features')).to.be.instanceOf(SerenityBDDReporter);
        });

        describe ('the Rehearsal Report', () => {

            it('contains the story of what happened during a scene', () => {
                givenFollowingEvents(
                    sceneStarted(scene, startTime),
                    sceneFinished(scene, Result.SUCCESS, startTime + duration),
                );

                return stageManager.waitForNextCue().then(_ =>
                    expect(producedReport()).to.deep.equal(expectedReportWith({
                        startTime,
                        duration,
                        result:          Result[Result.SUCCESS],
                    })));
            });

            it('includes the details of what happened during specific activities', () => {
                givenFollowingEvents(
                    sceneStarted(scene, startTime),
                        activityStarted('Opens a browser', startTime + 1),
                        activityFinished('Opens a browser', Result.SUCCESS, startTime + 2),
                    sceneFinished(scene, Result.SUCCESS, startTime + 3),
                );

                return stageManager.waitForNextCue().then(_ =>
                    expect(producedReport()).to.deep.equal(expectedReportWith({
                        duration: 3,
                        testSteps: [ {
                            description: 'Opens a browser',
                            startTime:   startTime + 1,
                            duration:    1,
                            result:      'SUCCESS',
                            children:    [],
                        } ],
                    })));
            });

            it('covers multiple activities', () => {
                givenFollowingEvents(
                    sceneStarted(scene, startTime),
                        activityStarted('Opens a browser', startTime + 1),
                        activityFinished('Opens a browser', Result.SUCCESS, startTime + 2),
                        activityStarted('Navigates to amazon.com', startTime + 3),
                        activityFinished('Navigates to amazon.com', Result.SUCCESS, startTime + 4),
                    sceneFinished(scene, Result.SUCCESS, startTime + 5),
                );

                return stageManager.waitForNextCue().then(_ =>
                    expect(producedReport()).to.deep.equal(expectedReportWith({
                        duration: 5,
                        testSteps: [ {
                            description: 'Opens a browser',
                            startTime: startTime + 1,
                            duration: 1,
                            result: 'SUCCESS',
                            children: [],
                        }, {
                            description: 'Navigates to amazon.com',
                            startTime: startTime + 3,
                            duration: 1,
                            result: 'SUCCESS',
                            children: [],
                        } ],
                    })));
            });

            it('covers activities in detail, including sub-activities', () => {
                givenFollowingEvents(
                    sceneStarted(scene, startTime),
                        activityStarted('Buys a discounted e-book reader', startTime + 1),
                            activityStarted('Opens a browser', startTime + 2),
                            activityFinished('Opens a browser', Result.SUCCESS, startTime + 3),
                            activityStarted('Searches for discounted e-book readers', startTime + 4),
                                activityStarted('Navigates to amazon.com', startTime + 5),
                                activityFinished('Navigates to amazon.com', Result.SUCCESS, startTime + 6),
                            activityFinished('Searches for discounted e-book readers', Result.SUCCESS, startTime + 7),
                        activityFinished('Buys a discounted e-book reader', Result.SUCCESS, startTime + 8),
                    sceneFinished(scene, Result.SUCCESS, startTime + 9),
                );

                return stageManager.waitForNextCue().then(_ =>
                    expect(producedReport()).to.deep.equal(expectedReportWith({
                        duration: 9,
                        testSteps: [ {
                            description: 'Buys a discounted e-book reader',
                            startTime: startTime + 1,
                            duration: 7,
                            result: 'SUCCESS',
                            children: [ {
                                description: 'Opens a browser',
                                startTime: startTime + 2,
                                duration: 1,
                                result: 'SUCCESS',
                                children: [],
                            }, {
                                description: 'Searches for discounted e-book readers',
                                startTime: startTime + 4,
                                duration: 3,
                                result: 'SUCCESS',
                                children: [ {
                                    description: 'Navigates to amazon.com',
                                    startTime: startTime + 5,
                                    duration: 1,
                                    result: 'SUCCESS',
                                    children: [],
                                } ],
                            } ],
                        } ],
                    })));
            });

            describe('When working with photos', () => {

                it('contains pictures', () => {
                    givenFollowingEvents(
                        sceneStarted(scene, startTime),
                            activityStarted('Specifies the default email address', startTime + 1),
                            photoTaken('Specifies the default email address', 'picture1.png', startTime + 1),
                            activityFinished('Specifies the default email address', Result.SUCCESS, startTime + 2),
                            photoTaken('Specifies the default email address', 'picture2.png', startTime + 2),
                        sceneFinished(scene, Result.SUCCESS, startTime + 3),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport()).to.deep.equal(expectedReportWith({
                            duration: 3,
                            testSteps: [ {
                                description: 'Specifies the default email address',
                                startTime: startTime + 1,
                                duration: 1,
                                result: 'SUCCESS',
                                children: [],
                                screenshots: [
                                    { screenshot: 'picture1.png' },
                                    { screenshot: 'picture2.png' },
                                ],
                            } ],
                        })));
                });

                it('ignores the photos that have been attempted but failed (ie. because webdriver was not ready)', () => {

                    givenFollowingEvents(
                        sceneStarted(scene, startTime),
                            activityStarted('Buys a discounted e-book reader', startTime + 1),
                            activityFinished('Buys a discounted e-book reader', Result.SUCCESS, startTime + 2),
                            photoFailed('Buys a discounted e-book reader', startTime + 2),
                        sceneFinished(scene, Result.SUCCESS, startTime + 3),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport()).to.deep.equal(expectedReportWith({
                            duration: 3,
                            testSteps: [ {
                                description: 'Buys a discounted e-book reader',
                                startTime: startTime + 1,
                                duration: 1,
                                result: 'SUCCESS',
                                children: [],
                            } ],
                        })));
                });

                it('covers activities in detail, including photos for sub-activities', () => {
                    givenFollowingEvents(
                        sceneStarted(scene, startTime),                                                                 // current: scene
                            activityStarted('Buys a discounted e-book reader', startTime + 1),                          // current: buys,   previous: scene
                                activityStarted('Opens a browser', startTime + 2),                                      // current: opens,  previous: buys
                                activityFinished('Opens a browser', Result.SUCCESS, startTime + 3),                     // current: buys,   previous: _
                                photoTaken('Opens a browser', 'opens_browser.png', startTime + 3),                      // current: opens,  previous:
                                activityStarted('Searches for discounted e-book readers', startTime + 4),
                                    activityStarted('Navigates to amazon.com', startTime + 5),
                                    activityFinished('Navigates to amazon.com', Result.SUCCESS, startTime + 6),
                                    photoTaken('Navigates to amazon.com', 'navigates.png', startTime + 6),
                                activityFinished('Searches for discounted e-book readers', Result.SUCCESS, startTime + 7),
                                photoTaken('Searches for discounted e-book readers', 'searches.png', startTime + 7),
                            activityFinished('Buys a discounted e-book reader', Result.SUCCESS, startTime + 8),
                            photoTaken('Buys a discounted e-book reader', 'buys.png', startTime + 8),
                        sceneFinished(scene, Result.SUCCESS, startTime + 9),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport()).to.deep.equal(expectedReportWith({
                            duration: 9,
                            testSteps: [ {
                                description: 'Buys a discounted e-book reader',
                                startTime: startTime + 1,
                                duration: 7,
                                result: 'SUCCESS',
                                screenshots: [
                                    { screenshot: 'buys.png' },
                                ],
                                children: [ {
                                    description: 'Opens a browser',
                                    startTime: startTime + 2,
                                    duration: 1,
                                    result: 'SUCCESS',
                                    children: [],
                                    screenshots: [
                                        { screenshot: 'opens_browser.png' },
                                    ],
                                }, {
                                    description: 'Searches for discounted e-book readers',
                                    startTime: startTime + 4,
                                    duration: 3,
                                    result: 'SUCCESS',
                                    children: [ {
                                        description: 'Navigates to amazon.com',
                                        startTime: startTime + 5,
                                        duration: 1,
                                        result: 'SUCCESS',
                                        children: [],
                                        screenshots: [
                                            { screenshot: 'navigates.png' },
                                        ],
                                    } ],
                                    screenshots: [
                                        { screenshot: 'searches.png' },
                                    ],
                                } ],
                            } ],
                        })));
                });

                it('covers activities in detail, including photos for sub-activities, even those deeply nested ones', () => {
                    givenFollowingEvents(
                        sceneStarted(scene, startTime),
                            activityStarted('Buys a discounted e-book reader', startTime + 1),
                                activityStarted('Searches for discounted e-book readers', startTime + 4),
                                    activityStarted('Navigates to amazon.com', startTime + 5),
                                        activityStarted('Enters https://amazon.com in the search bar', startTime + 5),
                                        activityFinished('Enters https://amazon.com in the search bar', Result.SUCCESS, startTime + 6),
                                        photoTaken('Enters https://amazon.com in the search bar', 'enters_url.png', startTime + 6),
                                    activityFinished('Navigates to amazon.com', Result.SUCCESS, startTime + 7),
                                    photoTaken('Navigates to amazon.com', 'navigates.png', startTime + 7),
                                activityFinished('Searches for discounted e-book readers', Result.SUCCESS, startTime + 8),
                                photoTaken('Searches for discounted e-book readers', 'searches.png', startTime + 8),
                            activityFinished('Buys a discounted e-book reader', Result.SUCCESS, startTime + 9),
                            photoTaken('Buys a discounted e-book reader', 'buys.png', startTime + 9),
                        sceneFinished(scene, Result.SUCCESS, startTime + 10),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport()).to.deep.equal(expectedReportWith({
                            duration: 10,
                            testSteps: [ {
                                description: 'Buys a discounted e-book reader',
                                startTime: startTime + 1,
                                duration: 8,
                                result: 'SUCCESS',
                                screenshots: [
                                    { screenshot: 'buys.png' },
                                ],
                                children: [ {
                                    description: 'Searches for discounted e-book readers',
                                    startTime: startTime + 4,
                                    duration: 4,
                                    result: 'SUCCESS',
                                    children: [ {
                                        description: 'Navigates to amazon.com',
                                        startTime: startTime + 5,
                                        duration: 2,
                                        result: 'SUCCESS',
                                        children: [{
                                            description: 'Enters https://amazon.com in the search bar',
                                            startTime: startTime + 5,
                                            duration: 1,
                                            result: 'SUCCESS',
                                            children: [],
                                            screenshots: [
                                                { screenshot: 'enters_url.png' },
                                            ],
                                        }],
                                        screenshots: [
                                            { screenshot: 'navigates.png' },
                                        ],
                                    } ],
                                    screenshots: [
                                        { screenshot: 'searches.png' },
                                    ],
                                } ],
                            } ],
                        })));
                });
            });

            describe('When problems are encountered', () => {

                it('describes problems encountered', () => {
                    const error = new Error("We're sorry, something happened");

                    error.stack = [
                        "Error: We're sorry, something happened",
                        '    at callFn (/fake/path/node_modules/mocha/lib/runnable.js:326:21)',
                        '    at Test.Runnable.run (/fake/path/node_modules/mocha/lib/runnable.js:319:7)',
                        // and so on
                    ].join('\n');

                    givenFollowingEvents(
                        sceneStarted(scene, startTime),
                        activityStarted('Buys a discounted e-book reader', startTime + 1),
                        activityFinished('Buys a discounted e-book reader', Result.ERROR, startTime + 2, error),
                        sceneFinished(scene, Result.ERROR, startTime + 3, error),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport()).to.deep.equal(expectedReportWith({
                            duration: 3,
                            testSteps: [ {
                                description: 'Buys a discounted e-book reader',
                                startTime: startTime + 1,
                                duration: 1,
                                result: 'ERROR',
                                children: [],
                                exception: {
                                    errorType: 'Error',
                                    message: "We're sorry, something happened",
                                    stackTrace: [ {
                                        declaringClass: '',
                                        fileName: '/fake/path/node_modules/mocha/lib/runnable.js',
                                        lineNumber: 326,
                                        methodName: 'callFn()',
                                    }, {
                                        declaringClass: '',
                                        fileName: '/fake/path/node_modules/mocha/lib/runnable.js',
                                        lineNumber: 319,
                                        methodName: 'Test.Runnable.run()',
                                    } ],
                                },
                            } ],
                            result: 'ERROR',
                            annotatedResult: 'ERROR',
                            testFailureCause: {
                                errorType: 'Error',
                                message: "We're sorry, something happened",
                                stackTrace: [ {
                                    declaringClass: '',
                                    fileName: '/fake/path/node_modules/mocha/lib/runnable.js',
                                    lineNumber: 326,
                                    methodName: 'callFn()',
                                }, {
                                    declaringClass: '',
                                    fileName: '/fake/path/node_modules/mocha/lib/runnable.js',
                                    lineNumber: 319,
                                    methodName: 'Test.Runnable.run()',
                                } ],
                            },
                        })));
                });

                it('describes test infrastructure problems encountered during the test', () => {
                    const error = new Error('Timeout of 1000ms exceeded.');
                    error.stack = '';   // we don't care about the stack in this test

                    givenFollowingEvents(
                        sceneStarted(scene, startTime),
                        activityStarted('Buys a discounted e-book reader', startTime + 1),
                        sceneFinished(scene, Result.ERROR, startTime + 1001, error),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport()).to.deep.equal(expectedReportWith({
                            duration: 1001,
                            testSteps: [ {
                                description: 'Buys a discounted e-book reader',
                                startTime: startTime + 1,
                                duration: 1000,
                                result: 'ERROR',
                                children: [],
                                exception: {
                                    errorType: 'Error',
                                    message: 'Timeout of 1000ms exceeded.',
                                    stackTrace: [],
                                },
                            } ],
                            result: 'ERROR',
                            annotatedResult: 'ERROR',
                            testFailureCause: {
                                errorType: 'Error',
                                message: 'Timeout of 1000ms exceeded.',
                                stackTrace: [],
                            },
                        })));
                });

                it('describes assertion errors that don\'t have a stacktrace', () => {
                    try {
                        expect(true).to.equal(false);
                    } catch (error) {

                        givenFollowingEvents(
                            sceneStarted(scene, startTime),
                            activityStarted('Buys a discounted e-book reader', startTime + 1),
                            sceneFinished(scene, Result.ERROR, startTime + 1001, error),
                        );

                        return stageManager.waitForNextCue().then(_ =>
                            expect(producedReport()).to.deep.equal(expectedReportWith({
                                duration: 1001,
                                testSteps: [ {
                                    description: 'Buys a discounted e-book reader',
                                    startTime: startTime + 1,
                                    duration: 1000,
                                    result: 'ERROR',
                                    children: [],
                                    exception: {
                                        errorType: 'AssertionError',
                                        message: 'expected true to equal false',
                                        stackTrace: [],
                                    },
                                } ],
                                result: 'ERROR',
                                annotatedResult: 'ERROR',
                                testFailureCause: {
                                    errorType: 'AssertionError',
                                    message: 'expected true to equal false',
                                    stackTrace: [],
                                },
                            })));
                        }
                });
            });

            describe('When feature files are grouped in directories', () => {

                it('reports the top-most directory as a "Capability", if there is only one level of nesting', () => {
                    const
                        capabilityDirectoryName = 'online_payments',
                        expectedCapabilityName  = 'Online payments',
                        featureName             = 'Card payments',
                        scenarioName            = 'Paying with a default card';

                    const aScene        = new RecordedScene(scenarioName, featureName, {
                        path: `${requirementsDir}/${capabilityDirectoryName}/card_payments.feature`,
                    });

                    givenFollowingEvents(
                        sceneStarted(aScene, startTime),
                        sceneFinished(aScene, Result.SUCCESS, startTime + 1),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport('ad1d4103e40456fafdcae4d92f99a0a7.json')).to.deep.equal(expectedReportWith({
                            id:     'paying-with-a-default-card;feature-onlinepayments-card-payments-capability-online-payments',
                            name:   'paying-with-a-default-card;feature-onlinepayments-card-payments-capability-online-payments',
                            duration: 1,
                            result: 'SUCCESS',
                            tags: [ {
                                name:  `${expectedCapabilityName}/${featureName}`,
                                type: 'feature',
                            }, {
                                name:  expectedCapabilityName,
                                type: 'capability',
                            } ],
                            userStory: {
                                id: 'card-payments',
                                path: 'online_payments/card_payments.feature',
                                storyName: 'Card payments',
                                type: 'feature',
                            },
                        })));
                });

                it('reports the themes and capabilities if there are two levels of nesting', () => {
                    const
                        themeDirectoryName      = 'online_payments',
                        expectedThemeName       = 'Online payments',
                        capabilityDirectoryName = 'card_payments',
                        expectedCapabilityName  = 'Card payments',
                        featureName             = 'Visa',
                        scenarioName            = 'Paying with a default card';

                    const aScene        = new RecordedScene(scenarioName, featureName, {
                        path: `${requirementsDir}/${themeDirectoryName}/${capabilityDirectoryName}/visa.feature`,
                    });

                    givenFollowingEvents(
                        sceneStarted(aScene, startTime),
                        sceneFinished(aScene, Result.SUCCESS, startTime + 1),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport('ebcfc6c234fd44e76183cb15dcc441d4.json')).to.deep.equal(expectedReportWith({
                            id:     'paying-with-a-default-card;feature-cardpayments-visa-capability-online-payments-card-payments-theme-online-payments',
                            name:   'paying-with-a-default-card;feature-cardpayments-visa-capability-online-payments-card-payments-theme-online-payments',
                            duration: 1,
                            result: 'SUCCESS',
                            tags: [ {
                                name:  `${expectedCapabilityName}/${featureName}`,
                                type: 'feature',
                            }, {
                                name:  `${expectedThemeName}/${expectedCapabilityName}`,
                                type: 'capability',
                            }, {
                                name:  expectedThemeName,
                                type: 'theme',
                            } ],
                            userStory: {
                                id:         'visa',
                                path:       `${themeDirectoryName}/${capabilityDirectoryName}/visa.feature`,
                                storyName:  featureName,
                                type:       'feature',
                            },
                        })));
                });
            });

            describe('When scenarios are tagged', () => {

                it('adds a tag for the feature covered', () => {
                    const aScene = new RecordedScene('Paying with a default card', 'Checkout', { path: `${requirementsDir}/checkout.feature` });

                    givenFollowingEvents(
                        sceneStarted(aScene, startTime),
                        sceneFinished(aScene, Result.SUCCESS, startTime + 1),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport()).to.deep.equal(expectedReportWith({
                            duration: 1,
                            result: 'SUCCESS',
                            tags: [ {
                                name: 'Checkout',
                                type: 'feature',
                            } ],
                        })));
                });

                it('describes the simple tags encountered', () => {
                    const taggedScene = new RecordedScene('Paying with a default card', 'Checkout', { path: `${requirementsDir}/checkout.feature` }, [
                        new Tag('regression'),
                    ]);

                    givenFollowingEvents(
                        sceneStarted(taggedScene, startTime),
                        sceneFinished(taggedScene, Result.SUCCESS, startTime + 1),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport('c8e5d709480c45d6a0e19252e8808c57.json')).to.deep.equal(expectedReportWith({
                            duration: 1,
                            id: 'paying-with-a-default-card;regression-feature-checkout',
                            name: 'paying-with-a-default-card;regression-feature-checkout',
                            result: 'SUCCESS',
                            tags: [{
                                name: 'regression',
                                type: 'tag',
                            }, {
                                name: 'Checkout',
                                type: 'feature',
                            }],
                        })));
                });

                it('describes the scenario as "manual" when it is tagged as such', () => {
                    const taggedScene = new RecordedScene('Paying with a default card', 'Checkout', { path: `${requirementsDir}/checkout.feature` }, [
                        new Tag('manual'),
                    ]);

                    givenFollowingEvents(
                        sceneStarted(taggedScene, startTime),
                        sceneFinished(taggedScene, Result.SUCCESS, startTime + 1),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport('8bab02c07b11ba0897286a8eea810e06.json')).to.deep.equal(expectedReportWith({
                            duration: 1,
                            id: 'paying-with-a-default-card;manual-external-tests-manual-feature-checkout',
                            name: 'paying-with-a-default-card;manual-external-tests-manual-feature-checkout',
                            result: 'SUCCESS',
                            manual: true,
                            tags: [{
                                name: 'manual',
                                type: 'tag',
                            }, {
                                name: 'Manual',
                                type: 'External Tests',
                            }, {
                                name: 'Checkout',
                                type: 'feature',
                            }],
                        })));
                });

                it('describes the complex tags encountered', () => {
                    const taggedScene = new RecordedScene('Paying with a default card', 'Checkout', { path: `${requirementsDir}/checkout.feature` }, [
                        new Tag('priority', [ 'must-have' ]),
                    ]);

                    givenFollowingEvents(
                        sceneStarted(taggedScene, startTime),
                        sceneFinished(taggedScene, Result.SUCCESS, startTime + 1),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport('96cf0cdb5ee2d58911ae1cb503e58483.json')).to.deep.equal(expectedReportWith({
                            duration: 1,
                            result: 'SUCCESS',
                            id: 'paying-with-a-default-card;priority-must-have-feature-checkout',
                            name: 'paying-with-a-default-card;priority-must-have-feature-checkout',
                            tags: [{
                                name: 'must-have',
                                type: 'priority',
                            }, {
                                name: 'Checkout',
                                type: 'feature',
                            }],
                        })));
                });

                it('adds in tags generated asynchronously', () => {
                    const aScene = new RecordedScene('Paying with a default card', 'Checkout', { path: `${requirementsDir}/checkout.feature` });

                    givenFollowingEvents(
                        sceneStarted(aScene, startTime),
                        sceneTagged(new Tag('browser', ['chrome']), startTime + 3),
                        sceneFinished(aScene, Result.SUCCESS, startTime + 2),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport('472e6b3067206747491fb55dbf61c239.json')).to.deep.equal(expectedReportWith({
                            id: 'paying-with-a-default-card;browser-chrome-feature-checkout',
                            name: 'paying-with-a-default-card;browser-chrome-feature-checkout',
                            duration: 2,
                            result: 'SUCCESS',
                            tags: [{
                                name: 'chrome',
                                type: 'browser',
                            }, {
                                name: 'Checkout',
                                type: 'feature',
                            }],
                        })));
                });

                it('specifies what "context icon" to use when the context tag is present', () => {
                    const aScene = new RecordedScene('Paying with a default card', 'Checkout', { path: `${requirementsDir}/checkout.feature` });

                    givenFollowingEvents(
                        sceneStarted(aScene, startTime),
                        sceneTagged(new Tag('context', ['chrome']), startTime + 3),
                        sceneFinished(aScene, Result.SUCCESS, startTime + 2),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport('8ef92158f9b14acefaa3195907f0d519.json')).to.deep.equal(expectedReportWith({
                            id: 'paying-with-a-default-card;context-chrome-feature-checkout',
                            name: 'paying-with-a-default-card;context-chrome-feature-checkout',
                            duration: 2,
                            result: 'SUCCESS',
                            tags: [{
                                name: 'chrome',
                                type: 'context',
                            }, {
                                name: 'Checkout',
                                type: 'feature',
                            }],
                            context:   'chrome',
                        })));
                });

                it('extracts the value of any @issues tags encountered and breaks them down to one tag per issue', () => {
                    const taggedScene = new RecordedScene('Paying with a default card', 'Checkout', { path: `${requirementsDir}/checkout.feature` }, [
                        new Tag('issues', [ 'MY-PROJECT-123', 'MY-PROJECT-456' ]),
                        new Tag('issues', [ 'MY-PROJECT-789' ]),
                    ]);

                    givenFollowingEvents(
                        sceneStarted(taggedScene, startTime),
                        sceneFinished(taggedScene, Result.SUCCESS, startTime + 1),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport('ff634f0cc40700bd59177d4e5ae57b02.json')).to.deep.equal(expectedReportWith({
                            duration: 1,
                            result: 'SUCCESS',
                            id:   'paying-with-a-default-card;issue-my-project-123-issue-my-project-456-issue-my-project-789-feature-checkout',
                            name: 'paying-with-a-default-card;issue-my-project-123-issue-my-project-456-issue-my-project-789-feature-checkout',
                            tags: [{
                                name: 'MY-PROJECT-123',
                                type: 'issue',
                            }, {
                                name: 'MY-PROJECT-456',
                                type: 'issue',
                            }, {
                                name: 'MY-PROJECT-789',
                                type: 'issue',
                            }, {
                                name: 'Checkout',
                                type: 'feature',
                            }],
                            issues: [
                                'MY-PROJECT-123',
                                'MY-PROJECT-456',
                                'MY-PROJECT-789',
                            ],
                        })));
                });

                it('ensures that the extracted issue ids are unique', () => {
                    const taggedScene = new RecordedScene('Paying with a default card', 'Checkout', { path: `${requirementsDir}/checkout.feature` }, [
                        new Tag('issues', [ 'MY-PROJECT-123', 'MY-PROJECT-456' ]),
                        new Tag('issue',  [ 'MY-PROJECT-123' ]),
                    ]);

                    givenFollowingEvents(
                        sceneStarted(taggedScene, startTime),
                        sceneFinished(taggedScene, Result.SUCCESS, startTime + 1),
                    );

                    return stageManager.waitForNextCue().then(_ =>
                        expect(producedReport('e5519b45036f53dfc53934ff569b72d2.json')).to.deep.equal(expectedReportWith({
                            duration: 1,
                            result: 'SUCCESS',
                            id:   'paying-with-a-default-card;issue-my-project-123-issue-my-project-456-issue-my-project-123-feature-checkout',
                            name: 'paying-with-a-default-card;issue-my-project-123-issue-my-project-456-issue-my-project-123-feature-checkout',
                            tags: [{
                                name: 'MY-PROJECT-123',
                                type: 'issue',
                            }, {
                                name: 'MY-PROJECT-456',
                                type: 'issue',
                            }, {
                                name: 'Checkout',
                                type: 'feature',
                            }],
                            issues: [
                                'MY-PROJECT-123',
                                'MY-PROJECT-456',
                            ],
                        })));
                });
            });

            function givenFollowingEvents(...events: Array<DomainEvent<any>>) {
                events.forEach(event => stage.manager.notifyOf(event));
            }

            function sceneStarted(s: RecordedScene, timestamp: number) {
                return new SceneStarts(s, timestamp);
            }

            function sceneTagged(tag: Tag, timestamp: number) {
                return new SceneTagged(Promise.resolve(tag), timestamp);
            }

            function activityStarted(name: string, timestamp: number) {
                return new ActivityStarts(new RecordedActivity(name), timestamp);
            }

            function activityFinished(name: string, r: Result, ts: number, e?: Error) {
                return new ActivityFinished(new Outcome(new RecordedActivity(name), r, e), ts);
            }

            function sceneFinished(s: RecordedScene, r: Result, timestamp: number, e?: Error) {
                return new SceneFinished(new Outcome(s, r, e), timestamp);
            }

            function photoTaken(name: string, path: string, timestamp: number) {
                return new PhotoAttempted(new PhotoReceipt(new RecordedActivity(name), Promise.resolve(new Photo(path))), timestamp);
            }

            function photoFailed(name, timestamp) {
                return new PhotoAttempted(new PhotoReceipt(new RecordedActivity(name), Promise.resolve(undefined)), timestamp);
            }

            function expectedReportWith(overrides: any) {
                const report = {
                    // todo: does the id/name affect anything in the navigation of the report?
                    id:   'paying-with-a-default-card;feature-checkout',
                    name: 'paying-with-a-default-card;feature-checkout',
                    testSteps: [],
                    issues: [],
                    userStory: {
                        id: 'checkout',
                        storyName: 'Checkout',
                        path: 'checkout.feature',
                        // narrative: '\nIn order to make me feel a sense of accomplishment\nAs a forgetful person\nI want to ...',
                        type: 'feature',
                    },
                    title:       'Paying with a default card',
                    description: '',
                    tags: [{
                        name: 'Checkout',
                        type: 'feature',
                    }],
                    manual:    false,
                    startTime,
                    duration:  undefined,
                    result:          'SUCCESS',
                    annotatedResult: 'SUCCESS',
                    testSource: 'cucumber',
                };

                return Object.assign(report, overrides);
            }

            function producedReport(filename: string = '183050024e32d5f68bd5c1f367308f04.json') {
                return JSON.parse(fs.readFileSync(`${outputDir}/${filename}`).toString('ascii'));
            }
        });
    });
});
