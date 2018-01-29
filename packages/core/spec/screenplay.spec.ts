import { Ability, Actor, Interaction, PerformsTasks, Question, Task, UsesAbilities } from '../src/screenplay';

import expect = require('./expect');
import sinon = require('sinon');
import { SinonSpyCall } from '@types/sinon';

describe('Screenplay Pattern', () => {

    let acousticGuitar: AcousticGuitar;

    beforeEach(() => acousticGuitar = sinon.createStubInstance(AcousticGuitar) as any);

    describe('Actor', () => {

        it('can be identified by their name', () => {

            const actor = Actor.named('Chris');

            expect(actor.toString()).to.equal('Chris');
        });

        it('has Abilities allowing them to perform Actions and interact with a given Interface: a web browser, a REST API or a guitar', () => {

            const actor = Actor.named('Chris').whoCan(PlayAnInstrument.suchAs(acousticGuitar));

            return actor.attemptsTo(
                PlayAChord.called(Chords.AMajor),
            )
            .then(() => {
                expect(acousticGuitar.play).to.have.been.calledWith(Chords.AMajor);
            });
        });

        it('performs Tasks to accomplish their Business Goals', () => {

            const actor = Actor.named('Chris').whoCan(PlayAnInstrument.suchAs(acousticGuitar));

            return actor.attemptsTo(
                PerformASong.from(MusicSheets.Wild_Thing),
            )
            .then(() => {
                expect(invocation(0, acousticGuitar.play)).to.have.been.calledWith(Chords.AMajor);
                expect(invocation(1, acousticGuitar.play)).to.have.been.calledWith(Chords.DMajor);
                expect(invocation(2, acousticGuitar.play)).to.have.been.calledWith(Chords.EMajor);
            });
        });

        it('asks Questions about the state of the Interface', () => {

            const actor = Actor.named('Chris').whoCan(PlayAnInstrument.suchAs(acousticGuitar));

            expect(actor.toSee(NumberOfGuitarStrings.left())).equal(6);
        });

        it('admits if it does not have the Abilities necessary to accomplish the given Action', () => {
            const actor = Actor.named('Ben');

            return expect(actor.attemptsTo(PlayAChord.called(Chords.AMajor)))
                .to.be.eventually.rejectedWith('I don\'t have the ability to PlayAnInstrument, said Ben sadly.');
        });

        function invocation(n: number, spy: any): SinonSpyCall {
            return spy.getCall(n);
        }
    });

    describe('Task', () => {

        it('describes high-level, business domain-focused activities, composed of either other Tasks or Actions', () => {

            const actor = sinon.createStubInstance(Actor) as any;

            PerformASong.from(MusicSheets.Wild_Thing).performAs(actor);

            expect(actor.attemptsTo).to.have.been.calledWith(
                PlayAChord.called(Chords.AMajor),
                PlayAChord.called(Chords.DMajor),
                PlayAChord.called(Chords.EMajor),
            );
        });

        it('can be implemented as a placeholder to be "chunked down" later', () => {
            const task = Task.where(`#actor doesn't have the interface to interact with yet`);

            expect(task).to.have.property('performAs');
        });
    });

    describe('Interaction', () => {
        it('describes low-level, Interface-focused activity, directly exercising the Actor\'s Ability to interact with said Interface', () => {
            const
                ability = PlayAnInstrument.suchAs(acousticGuitar),
                play    = sinon.stub(ability, 'play'),
                actor   = Actor.named('Chris').whoCan(ability),
                action  = PlayAChord.called(Chords.AMajor);

            action.performAs(actor);

            expect(play).to.have.been.calledWith(Chords.AMajor);
        });

        it('can be implemented as a one-liner', () => {
            const Play = (chord: Chord) => Interaction.where(`#actor plays ${chord}`, actor => PlayAnInstrument.as(actor).play(chord));

            expect(Play(Chords.AMajor)).to.have.property('performAs');
        });
    });

    describe('Question', () => {

        it('can be implemented as a one-liner', () => {
            const chris = Actor.named('Chris').whoCan(PlayAnInstrument.suchAs(acousticGuitar));

            const NumberOfGuitarStringsLeft = () => Question.about(`the number of strings left`, actor => 6);

            expect(NumberOfGuitarStringsLeft().answeredBy(chris)).to.equal(6);
        });
    });

    describe('Ability', () => {
        it('allows the Actor to interact with some external Interface, such as a web browser, an API, etc.', () => {
            const actor = Actor.named('Chris').whoCan(PlayAnInstrument.suchAs(acousticGuitar));

            expect(PlayAnInstrument.as(actor)).to.be.instanceOf(PlayAnInstrument);
            expect(PlayAnInstrument.as(actor)).to.have.property('play');
        });
    });

    class Chord {
        constructor(public name: string,
                    private E_6TH: number,
                    private A_5TH: number,
                    private D_4TH: number,
                    private G_3RD: number,
                    private B_2ND: number,
                    private E_1ST: number) {
        }

        toString = () => this.name;
    }

    class Chords {
        public static AMajor    = new Chord('CSharpMinor7', 0, 0, 2, 2, 2, 0);
        public static DMajor    = new Chord('DMajor',       0, 0, 0, 2, 3, 2);
        public static EMajor    = new Chord('EMajor',       0, 2, 2, 1, 0, 0);
    }

    class MusicSheet {
        constructor(public chords: Chord[]) {};
    }

    class MusicSheets {
        public static Wild_Thing = new MusicSheet([ Chords.AMajor, Chords.DMajor, Chords.EMajor ]);
    }

    class PerformASong implements Task {
        static from(musicSheet: MusicSheet) {
            return new PerformASong(musicSheet);
        }

        performAs(actor: PerformsTasks): PromiseLike<void> {
            return actor.attemptsTo.apply(actor, this.playThe(this.musicSheet.chords));
        }

        constructor(private musicSheet: MusicSheet) { }

        private playThe(chords: Chord[]): Interaction[] {
            return chords.map(chord => PlayAChord.called(chord));
        }
    }

    class PlayAChord implements Interaction {
        static called(chord: Chord) {
            return new PlayAChord(chord);
        }

        performAs(actor: UsesAbilities): PromiseLike<void> {
            return PlayAnInstrument.as(actor).play(this.chord);
        }

        constructor(private chord: Chord) {
        }
    }

    class NumberOfGuitarStrings implements Question<number> {

        static left(): Question<number> {
            return new NumberOfGuitarStrings();
        }

        answeredBy(actor: UsesAbilities): number {
            return 6;
        }
    }

    interface Instrument {
        play(chord: Chord): PromiseLike<any>;
    }

    class AcousticGuitar implements Instrument {
        play(chord: Chord): PromiseLike<any> {
            // use some "guitar driver" to play the chord on the "real guitar"
            return Promise.resolve();
        }
    }

    class PlayAnInstrument implements Ability {

        /**
         * Instantiates the Ability to PlayAnInstrument, allowing the Actor to PerformASong
         *
         * @param instrument
         * @return {PlayAnInstrument}
         */
        static suchAs(instrument: Instrument) {
            return new PlayAnInstrument(instrument);
        }

        /**
         * Used to access the Actor's ability to Drive from within the Action classes
         *
         * @param actor
         * @return {PlayAnInstrument}
         */
        static as(actor: UsesAbilities): PlayAnInstrument {
            return actor.abilityTo(PlayAnInstrument);
        }

        /**
         * Instrument-specific interface, allowing the actor to interact with it.
         * If it the Ability was to BrowseTheWeb, instead of "play" method it'd have had methods
         * such as "findElementById"
         *
         * @param chord
         */
        play(chord: Chord): PromiseLike<void> {
            return this.instrument.play(chord);
        }

        /**
         * The Ability to PlayAnInstrument allows the Actor to interact with an Instrument,
         * in the same way as the Ability to BrowseTheWeb allows to interact with a WebDriver Browser
         *
         * @param instrument
         */
        constructor(private instrument: Instrument) { }
    }
});
