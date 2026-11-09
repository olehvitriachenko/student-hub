import { Services } from '../../AppServices';
import { bindText } from '../../core/mvvm/hooks';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { AuthScreen } from '../../components/AuthScreen';
import { Banner, CommandButton, Field } from '../../components/ui';

/** LoginPage (View): лише прив'язки до LoginViewModel. */
export default function LoginPage() {
  const vm = usePageViewModel(Services.LoginViewModel);

  return (
    <AuthScreen
      back={vm.backCommand}
      title="З поверненням"
      subtitle="Увійдіть, щоб побачити розклад і завдання."
      bottom={
        <>
          <CommandButton command={vm.loginCommand} title="Увійти" />
          <CommandButton command={vm.openRegisterCommand} title="Ще немає акаунта? Зареєструватися" variant="ghost" compact />
        </>
      }
    >
      <Field
        icon="mail-outline"
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        autoFocus
        {...bindText(vm, 'email')}
      />
      <Field
        icon="lock-closed-outline"
        placeholder="Пароль"
        secure
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => vm.loginCommand.execute()}
        {...bindText(vm, 'password')}
      />
      {vm.error ? <Banner text={vm.error} /> : null}
    </AuthScreen>
  );
}
