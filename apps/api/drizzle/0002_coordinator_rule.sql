-- O coordenador de um vendedor tem de ser mesmo um coordenador (docs/05-modelo-dados). O CHECK da
-- tabela só garante que vendedor tem coordenador e os demais perfis não; um CHECK não enxerga
-- outra linha, então esta regra fica em trigger.
CREATE FUNCTION "user_check_coordinator"() RETURNS trigger AS $$
BEGIN
	-- FOR SHARE segura a linha do coordenador até o fim da transação: sem isso, outra transação
	-- poderia mudar o perfil dele entre esta conferência e o commit.
	IF NEW."coordinator_id" IS NOT NULL
		AND (SELECT "role" FROM "user" WHERE "id" = NEW."coordinator_id" FOR SHARE) IS DISTINCT FROM 'coordinator' THEN
		RAISE EXCEPTION 'coordinator_id deve apontar para um usuário com perfil coordinator'
			USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "user_check_coordinator"
	BEFORE INSERT OR UPDATE OF "role", "coordinator_id" ON "user"
	FOR EACH ROW EXECUTE FUNCTION "user_check_coordinator"();
--> statement-breakpoint
-- O inverso: quem tem vendedores não deixa de ser coordenador.
CREATE FUNCTION "user_check_coordinator_keeps_role"() RETURNS trigger AS $$
BEGIN
	IF NEW."role" <> 'coordinator'
		AND EXISTS (SELECT 1 FROM "user" WHERE "coordinator_id" = NEW."id") THEN
		RAISE EXCEPTION 'o usuário tem vendedores e deve continuar com o perfil coordinator'
			USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "user_check_coordinator_keeps_role"
	BEFORE UPDATE OF "role" ON "user"
	FOR EACH ROW EXECUTE FUNCTION "user_check_coordinator_keeps_role"();
