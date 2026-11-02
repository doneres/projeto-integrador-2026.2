import { fireEvent, render, screen } from '@testing-library/react-native'
import { Button } from './button'
import { Checkbox } from './checkbox'
import { ListItem } from './list-item'
import { Logo } from './logo'
import { Notice } from './notice'
import { TextField } from './text-field'
import { MIN_TOUCH_TARGET } from './touch-target'

describe('área de toque mínima (RNF03)', () => {
  it('é de 48 dp', () => {
    expect(MIN_TOUCH_TARGET).toBe(48)
  })

  it('vale para o botão', async () => {
    await render(
      <Button
        title="Salvar"
        accessibilityLabel="Salvar cliente"
        accessibilityRole="button"
        onPress={jest.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Salvar cliente' })).toHaveStyle({
      minHeight: MIN_TOUCH_TARGET,
      minWidth: MIN_TOUCH_TARGET,
    })
  })

  it('vale para o item de lista', async () => {
    await render(
      <ListItem
        title="Padaria Estrela"
        accessibilityLabel="Abrir Padaria Estrela"
        accessibilityRole="button"
        onPress={jest.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Abrir Padaria Estrela' })).toHaveStyle({
      minHeight: MIN_TOUCH_TARGET,
    })
  })

  it('vale para o checkbox', async () => {
    await render(
      <Checkbox
        title="Íntegro"
        checked={false}
        onCheckedChange={jest.fn()}
        accessibilityLabel="Marcar íntegro"
        accessibilityRole="checkbox"
      />,
    )
    expect(screen.getByRole('checkbox', { name: 'Marcar íntegro' })).toHaveStyle({
      minHeight: MIN_TOUCH_TARGET,
      minWidth: MIN_TOUCH_TARGET,
    })
  })

  it('vale para o campo de texto', async () => {
    await render(
      <TextField
        label="Cliente"
        value=""
        onChangeText={jest.fn()}
        accessibilityLabel="Nome do cliente"
        accessibilityRole="text"
      />,
    )
    expect(screen.getByLabelText('Nome do cliente')).toHaveStyle({ minHeight: MIN_TOUCH_TARGET })
  })
})

describe('Button', () => {
  it('chama onPress ao tocar', async () => {
    const onPress = jest.fn()
    await render(
      <Button
        title="Salvar"
        accessibilityLabel="Salvar cliente"
        accessibilityRole="button"
        onPress={onPress}
      />,
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar cliente' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('não chama onPress e se anuncia desabilitado quando disabled', async () => {
    const onPress = jest.fn()
    await render(
      <Button
        title="Salvar"
        accessibilityLabel="Salvar cliente"
        accessibilityRole="button"
        onPress={onPress}
        disabled
      />,
    )
    const button = screen.getByRole('button', { name: 'Salvar cliente' })
    await fireEvent.press(button)
    expect(onPress).not.toHaveBeenCalled()
    expect(button).toBeDisabled()
  })

  it('desabilitado troca de cor em vez de só esmaecer (contraste do texto)', async () => {
    await render(
      <Button
        title="Salvar"
        accessibilityLabel="Salvar cliente"
        accessibilityRole="button"
        onPress={jest.fn()}
        disabled
      />,
    )
    const className = screen.getByText('Salvar').props.className as string
    expect(className).toContain('text-textMuted')
    expect(screen.getByRole('button', { name: 'Salvar cliente' }).props.className).not.toContain(
      'opacity-50',
    )
  })
})

describe('Checkbox', () => {
  it('anuncia o estado marcado e alterna ao tocar', async () => {
    const onCheckedChange = jest.fn()
    await render(
      <Checkbox
        title="Íntegro"
        checked={false}
        onCheckedChange={onCheckedChange}
        accessibilityLabel="Marcar íntegro"
        accessibilityRole="checkbox"
      />,
    )
    const checkbox = screen.getByRole('checkbox', { name: 'Marcar íntegro' })
    expect(checkbox).not.toBeChecked()
    await fireEvent.press(checkbox)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('anuncia marcado quando checked', async () => {
    await render(
      <Checkbox
        title="Íntegro"
        checked
        onCheckedChange={jest.fn()}
        accessibilityLabel="Desmarcar íntegro"
        accessibilityRole="checkbox"
      />,
    )
    expect(screen.getByRole('checkbox', { name: 'Desmarcar íntegro' })).toBeChecked()
  })
})

describe('TextField', () => {
  it('mostra o rótulo e repassa o texto digitado', async () => {
    const onChangeText = jest.fn()
    await render(
      <TextField
        label="Cliente"
        value=""
        onChangeText={onChangeText}
        accessibilityLabel="Nome do cliente"
        accessibilityRole="text"
      />,
    )
    expect(screen.getByText('Cliente')).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Nome do cliente'), 'Padaria')
    expect(onChangeText).toHaveBeenCalledWith('Padaria')
  })

  it('mostra a mensagem de erro em texto', async () => {
    await render(
      <TextField
        label="Cliente"
        value=""
        onChangeText={jest.fn()}
        error="Informe o nome"
        accessibilityLabel="Nome do cliente"
        accessibilityRole="text"
      />,
    )
    expect(screen.getByText('Erro: Informe o nome')).toBeOnTheScreen()
  })
})

describe('ListItem', () => {
  it('mostra título e subtítulo e responde ao toque', async () => {
    const onPress = jest.fn()
    await render(
      <ListItem
        title="Padaria Estrela"
        subtitle="Rua 5, Goiânia"
        accessibilityLabel="Abrir Padaria Estrela"
        accessibilityRole="button"
        onPress={onPress}
      />,
    )
    expect(screen.getByText('Rua 5, Goiânia')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir Padaria Estrela' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('rótulo e papel de acessibilidade obrigatórios', () => {
  it('são exigidos pelo TypeScript', () => {
    const naoExecuta = () => (
      <>
        {/* @ts-expect-error falta accessibilityLabel */}
        <Button title="x" accessibilityRole="button" onPress={jest.fn()} />
        {/* @ts-expect-error falta accessibilityRole */}
        <Button title="x" accessibilityLabel="x" onPress={jest.fn()} />
        {/* @ts-expect-error falta accessibilityLabel */}
        <Checkbox title="x" checked onCheckedChange={jest.fn()} accessibilityRole="checkbox" />
        {/* @ts-expect-error falta accessibilityRole */}
        <ListItem title="x" accessibilityLabel="x" onPress={jest.fn()} />
        {/* @ts-expect-error falta accessibilityLabel */}
        <TextField label="x" value="" onChangeText={jest.fn()} accessibilityRole="text" />
      </>
    )
    expect(naoExecuta).toBeInstanceOf(Function)
  })
})

describe('Logo', () => {
  it('toque longo chama onLongPress e se anuncia como botão com dica', async () => {
    const onLongPress = jest.fn()
    await render(<Logo onLongPress={onLongPress} accessibilityHint="Toque longo para configurar" />)
    const logo = screen.getByRole('button', { name: 'AXIS' })
    await fireEvent(logo, 'longPress')
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('leitor de tela aciona a ação longpress', async () => {
    const onLongPress = jest.fn()
    await render(<Logo onLongPress={onLongPress} />)
    await fireEvent(screen.getByRole('button', { name: 'AXIS' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'longpress' },
    })
    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('sem onLongPress é só um título', async () => {
    await render(<Logo />)
    expect(screen.getByRole('header', { name: 'AXIS' })).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: 'AXIS' })).toHaveStyle({
      minHeight: MIN_TOUCH_TARGET,
    })
  })
})

describe('Notice', () => {
  it('é um alerta anunciado na hora, com texto "Erro:" além do ícone', async () => {
    await render(<Notice message="Senha incorreta" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveProp('accessibilityLiveRegion', 'assertive')
    expect(screen.getByText('Erro: Senha incorreta')).toBeOnTheScreen()
  })
})
