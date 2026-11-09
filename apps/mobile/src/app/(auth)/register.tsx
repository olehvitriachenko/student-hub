import { Text, View } from 'react-native';
import { Services } from '../../AppServices';
import { bindText } from '../../core/mvvm/hooks';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { AuthScreen } from '../../components/AuthScreen';
import { Banner, CommandButton, Field, Icon } from '../../components/ui';
import { spacing, usePalette } from '../../theme/theme';

/** RegisterPage (View): візард із трьох кроків; який крок показати — вирішує RegisterViewModel.step. */
export default function RegisterPage() {
  const vm = usePageViewModel(Services.RegisterViewModel);
  const c = usePalette();

  return (
    <AuthScreen
      back={vm.backCommand}
      step={vm.step}
      totalSteps={vm.totalSteps}
      title={vm.stepText.title}
      subtitle={vm.stepText.subtitle}
      bottom={
        <>
          <CommandButton command={vm.nextCommand} title={vm.stepText.action} icon={vm.step === 3 ? 'checkmark' : undefined} />
          {vm.step === 1 ? <CommandButton command={vm.openLoginCommand} title="Вже є акаунт? Увійти" variant="ghost" compact /> : null}
        </>
      }
    >
      {vm.step === 1 && (
        <Field
          key="email"
          icon="mail-outline"
          placeholder="student@university.ua"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
            returnKeyType="next"
          onSubmitEditing={() => vm.nextCommand.execute()}
          {...bindText(vm, 'email')}
        />
      )}

      {vm.step === 2 && (
        <>
          <Field key="password" icon="lock-closed-outline" placeholder="Пароль" secure autoFocus textContentType="newPassword" {...bindText(vm, 'password')} />
          <Field key="confirm" icon="shield-checkmark-outline" placeholder="Повторіть пароль" secure textContentType="newPassword" {...bindText(vm, 'confirm')} />
          <View style={{ gap: spacing.sm }}>
            {vm.passwordChecks.map((check) => (
              <View key={check.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon name={check.ok ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={check.ok ? c.success : c.textMuted} />
                <Text style={{ color: check.ok ? c.text : c.textMuted, fontSize: 15 }}>{check.label}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {vm.step === 3 && (
        <>
          <Field key="name" icon="person-outline" placeholder="Прізвище та ім’я" autoComplete="name" autoFocus {...bindText(vm, 'fullName')} />
          <Field key="group" icon="people-outline" placeholder="Група, напр. КН-31" autoCapitalize="characters" {...bindText(vm, 'group')} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <Icon name="information-circle-outline" size={18} color={c.textMuted} />
            <Text style={{ color: c.textMuted, fontSize: 14, flex: 1 }}>Дані можна змінити пізніше у профілі.</Text>
          </View>
        </>
      )}

      {vm.error ? <Banner text={vm.error} /> : null}
    </AuthScreen>
  );
}
