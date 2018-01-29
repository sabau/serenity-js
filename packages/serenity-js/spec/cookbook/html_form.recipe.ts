import expect = require('../expect');
import { Actor, BrowseTheWeb, Target } from '../../src/screenplay-protractor';
import { Click, Enter, Open, Select, SelectedValue, SelectedValues, Text, Value } from '../../src/serenity-protractor';

import { AppServer } from '../support/server';

import { by, protractor } from 'protractor';
import { Execute } from '../../src/serenity-protractor/screenplay/interactions/execute';
import { ensureCurrentBrowserIsNot } from './workarounds';

/// [pageobjects]
class Username {
    static Field  = Target.the('username field').located(by.css('[name="text-input"] label[for="text"] input'));
    static Result = Target.the('username value').located(by.css('[name="text-input"] label[for="text"] pre'));
}

class Bio {
    static Field  = Target.the('bio field').located(by.css('[name="text-input"] label[for="textarea"] textarea'));
    static Result = Target.the('bio value').located(by.css('[name="text-input"] label[for="textarea"] pre'));
}

class Newsletter {
    static Checkbox = Target.the('newsletter checkbox').located(by.css('[name="checkboxes"] label[for="checkbox"] input'));
    static Result   = Target.the('newsletter result').located(by.css('[name="checkboxes"] label[for="checkbox"] pre'));
}

class SingleCountry {
    static Selector = Target.the('country selector').located(by.css('[name="options"] label[for="single-option"] select'));
    static Result   = Target.the('country result').located(by.css('[name="options"] label[for="single-option"] pre'));
}

class MultiCountry {
    static Selector = Target.the('country selector').located(by.css('[name="options"] label[for="multiple-options"] select'));
    static Result   = Target.the('country result').located(by.css('[name="options"] label[for="multiple-options"] pre'));
}
/// [pageobjects]

describe ('When demonstrating the usage of an HTML form, a test scenario', function() {

    this.timeout(10000);

    const app   = new AppServer();
    const james = Actor.named('James').whoCan(BrowseTheWeb.using(protractor.browser));

    before(app.start());
    before(() => james.attemptsTo(Open.browserOn(app.demonstrating('html_form'))));
    after(app.stop());

    it ('can interact with a single-line text input', () =>

        james.attemptsTo(
            Enter.theValue('James').into(Username.Field),
        ).then(() => Promise.all([
            expect(james.toSee(Value.of(Username.Field))).eventually.equal('James'),
            expect(james.toSee(Text.of(Username.Result))).eventually.equal('James'),
        ])));

    it ('can interact with a text area', () =>

        james.attemptsTo(
            Enter.theValue('Lorem ipsum\ndolor\nsit amet').into(Bio.Field),
        ).then(() => Promise.all([
            expect(james.toSee(Value.of(Bio.Field))).eventually.equal('Lorem ipsum\ndolor\nsit amet'),
            expect(james.toSee(Text.of(Bio.Result))).eventually.equal('Lorem ipsum\ndolor\nsit amet'),
        ])));

    it ('can interact with a checkbox', () =>

        james.attemptsTo(
            Click.on(Newsletter.Checkbox),
        ).then(() => Promise.all([
            expect(james.toSee(Value.of(Newsletter.Checkbox))).eventually.equal('on'),
            expect(james.toSee(Text.of(Newsletter.Result))).eventually.equal('true'),
        ])));

    it ('can execute script to click a checkbox, as an example for script execution..', () =>
        james.attemptsTo(
            Execute.script('arguments[0].click();').on(Newsletter.Checkbox),
        ).then(() => Promise.all([
            expect(james.toSee(Value.of(Newsletter.Checkbox))).eventually.equal('on'),
        ])));

    it ('can interact with a select box', () =>

        james.attemptsTo(
            Select.theValue('France').from(SingleCountry.Selector),
        ).then(() => Promise.all([
            expect(james.toSee(SelectedValue.of(SingleCountry.Selector))).eventually.equal('France'),
            expect(james.toSee(Text.of(SingleCountry.Result))).eventually.equal('France'),
        ])));

    describe('when a real browser is available', () => {

        // see https://github.com/jan-molak/serenity-js/issues/17
        before(ensureCurrentBrowserIsNot('phantomjs'));

        it('can interact with multi-choice select box', () =>
            james.attemptsTo(
                Select.values('Poland', 'France').from(MultiCountry.Selector),
            ).then(() => Promise.all([
                expect(james.toSee(SelectedValues.of(MultiCountry.Selector))).eventually.deep.equal([ 'Poland', 'France' ]),
                expect(james.toSee(Text.of(MultiCountry.Result))).eventually.equal('Poland, France'),
            ])));
    });
});
