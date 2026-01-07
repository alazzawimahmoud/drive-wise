CREATE UNIQUE INDEX "choice_translations_choice_locale_idx" ON "choice_translations" USING btree ("choice_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "choices_question_position_idx" ON "choices" USING btree ("question_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "question_translations_question_locale_idx" ON "question_translations" USING btree ("question_id","locale");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_original_id_unique" UNIQUE("original_id");