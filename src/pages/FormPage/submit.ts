import React, {SyntheticEvent} from "react";

import ApiClient from "../../api/client";
import {Question, QuestionType} from "../../api/question";
import RenderedQuestion from "../../components/Question";


export enum FormState {
    SENDING = "sending",
    SENT = "sent"
}


/**
 * Handle validation and submission of a form.
 *
 * @param event The submission event.
 * @param formID The form ID.
 * @param questions A list of :RenderedQuestion: elements.
 * @param refMap A map of question ID to object refs.
 * @param setState A consumer which marks the current state of the form.
 */
export default async function handleSubmit(
    event: SyntheticEvent,
    formID: string,
    questions: RenderedQuestion[],
    refMap: Map<string, React.RefObject<RenderedQuestion>>,
    setState: (value: string) => void
): Promise<void> {
    event.preventDefault();

    if (!validate(questions, refMap)) {
        return;
    }

    setState(FormState.SENDING);
    await ApiClient.post(`forms/submit/${formID}`, {response: parseAnswers(questions)});
    setState(FormState.SENT);
}


/**
 * Run client side validation.
 */
function validate(questions: RenderedQuestion[], refMap: Map<string, React.RefObject<RenderedQuestion>>): boolean {
    const invalidFieldIDs: number[] = [];
    questions.forEach((prop, i) => {
        const question: Question = prop.props.question;
        if (!question.required) {
            return;
        }

        const questionRef = refMap.get(question.id);
        if (questionRef && questionRef.current) {
            questionRef.current.validateField();
        }
        // In case when field is invalid, add this to invalid fields list.
        if (prop.props.public_state.get("valid") === false) {
            invalidFieldIDs.push(i);
        }
    });

    if (invalidFieldIDs.length) {
        const firstErrored = questions[invalidFieldIDs[0]];
        if (firstErrored && firstErrored.props.scroll_ref) {
            // If any element is already focused, unfocus it to avoid not scrolling behavior.
            if (document.activeElement && document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            firstErrored.props.scroll_ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
            if (firstErrored.props.focus_ref && firstErrored.props.focus_ref.current) {
                firstErrored.props.focus_ref.current.focus({ preventScroll: true });
            }
        }

        return false;
    }

    return true;
}

/**
 * Parse user answers into a valid submission.
 */
function parseAnswers(questions: RenderedQuestion[]): { [key: string]: unknown } {
    const answers: { [key: string]: unknown } = {};

    questions.forEach(prop => {
        const question: Question = prop.props.question;
        const options: string | string[] = question.data["options"];

        // Parse input from each question
        switch (question.type) {
            case QuestionType.Section:
                answers[question.id] = false;
                break;

            case QuestionType.Checkbox: {
                if (typeof options !== "string") {
                    const keys: Map<string, string> = new Map();
                    options.forEach((val: string, index) => {
                        keys.set(val, `${("000" + index).slice(-4)}. ${val}`);
                    });
                    const pairs: { [key: string]: boolean } = { };
                    keys.forEach((val, key) => {
                        pairs[key] = !!prop.props.public_state.get(val);
                    });
                    answers[question.id] = pairs;
                }
                break;
            }

            case QuestionType.Code:
            default:
                answers[question.id] = prop.props.public_state.get("value");
        }
    });

    return answers;
}
