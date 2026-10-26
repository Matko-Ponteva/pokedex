import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { logInSchema } from "@pokedex/shared";
import { TextField } from "../components/TextField";
import { useCurrentUser, useLogIn } from "../hooks/useAuth";
import { toFieldErrors, type FieldErrors } from "../lib/formErrors";

export function LoginPage() {
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const { data: user } = useCurrentUser();
  const logIn = useLogIn();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/teams";

  if (user) return <Navigate to={redirectTo} replace />;

  function submit() {
    const result = logInSchema.safeParse(values);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    logIn.mutate(result.data);
  }

  return (
    <main className="auth-page">
      <h1>Log in</h1>
      <form
        className="auth-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(email) => setValues({ ...values, email })}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          error={errors.password}
          onChange={(password) => setValues({ ...values, password })}
        />
        {logIn.error && <p className="form-error" role="alert">{logIn.error.message}</p>}
        <button type="submit" disabled={logIn.isPending}>
          {logIn.isPending ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p>
        New here? <Link to="/signup" state={location.state}>Create an account</Link>
      </p>
    </main>
  );
}