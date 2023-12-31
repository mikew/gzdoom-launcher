import { Button, ButtonProps } from '@mui/material'
import { useForm, useFormState } from 'react-final-form'

interface FinalFormResetButtonProps extends Omit<ButtonProps, 'onClick'> {}

const FinalFormResetButton: React.FC<FinalFormResetButtonProps> = (props) => {
  const api = useForm()
  const formState = useFormState({
    subscription: { submitting: true, pristine: true },
  })

  return (
    <Button
      {...props}
      disabled={formState.submitting || formState.pristine}
      onClick={() => {
        api.reset()
      }}
    />
  )
}

export default FinalFormResetButton
