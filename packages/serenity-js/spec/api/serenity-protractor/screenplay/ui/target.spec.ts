import * as webdriver from 'selenium-webdriver';

import sinon = require('sinon');
import expect = require('../../../../expect');

import { Target } from '../../../../../src/screenplay-protractor';

describe ('Target', () => {

    const byLocator = webdriver.By.css('button#sign-up');

    it ('represents a named locator', () => {

        const target = Target.the('"Sign Up" button').located(byLocator);

        expect(target.toString()).to.equal('the "Sign Up" button');
    });

    it ('can be resolved using protractor `element` resolver', () => {
        const
            element     = sinon.spy(),
            target      = Target.the('"Sign Up" button').located(byLocator);

        target.resolveUsing(element);

        expect(element).to.have.been.calledWith(byLocator);
    });

    it ('can have its name changed at a later stage', () => {
        const target      = Target.the('Nav button').located(byLocator);

        expect(target.called('"Sign Up" button').toString()).to.equal('the "Sign Up" button');
    });

    it ('can have its name resolved at a later stage', () => {
        const target      = Target.the('"{0}" button').located(byLocator);

        expect(target.of('Sign Up').toString()).to.equal('the "Sign Up" button');
    });

    it ('can have a CSS locator defined using tokens to be resolved at a later stage', () => {
        const
            byLocatorTemplate = webdriver.By.css('{0}#sign-up.{1}'),
            element     = sinon.spy(),
            target      = Target.the('"Sign Up" button').located(byLocatorTemplate);

        target.of('button', 'active').resolveUsing(element);

        expect(element).to.have.been.calledWith(webdriver.By.css('button#sign-up.active'));
    });

    it ('can have an ID locator defined using tokens to be resolved at a later stage', () => {
        const
            byLocatorTemplate = webdriver.By.id('sign-up-{0}'),
            element     = sinon.spy(),
            target      = Target.the('"Sign Up" button').located(byLocatorTemplate);

        target.of('button').resolveUsing(element);

        expect(element).to.have.been.calledWith(webdriver.By.id('sign-up-button'));
    });

    it ('can have an XPath locator defined using numeric tokens to be resolved at a later stage', () => {
        const
            byLocatorTemplate = webdriver.By.xpath(`//ul[@id='items']//li[{0}]`),
            element     = sinon.spy(),
            target      = Target.the('n-th item').located(byLocatorTemplate);

        target.of(3).resolveUsing(element);

        expect(element).to.have.been.calledWith(webdriver.By.xpath(`//ul[@id='items']//li[3]`));
    });

    it ('correctly overrides the toString method of the cloned locator', () => {
        const
            byLocatorTemplate = webdriver.By.id('sign-up-{0}'),
            target      = Target.the('"Sign Up" button').located(byLocatorTemplate),

            result = (target.of('button') as any).locator.toString();

        expect(result).to.equal('By(css selector, *[id="sign-up-button"])');
    });

    it ('can describe a locator matching multiple elements', () => {
        const
            byGroupLocator = webdriver.By.css('ul>li'),
            element        = { all: sinon.spy() },
            target         = Target.the('items').located(byGroupLocator);

        target.resolveAllUsing(element);

        expect(element.all).to.have.been.calledWith(webdriver.By.css('ul>li'));
    });

    it ('complains if it cannot replace the tokens defined in the locator (Protractor issue #3508)', () => {
        const
            byModelTemplate: any = {
                toString: () => 'by.model("checkbox")',
            },
            target      = Target.the('checkbox').located(byModelTemplate);

        expect(() => {
            target.of('some-replacement');
        }).to.throw('by.model("checkbox") is not a webdriver-compatible locator so you won\'t be able to use token replacement with it');
    });
});
