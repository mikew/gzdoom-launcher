import { useMutation, useSuspenseQuery } from '@apollo/client'
import {
  Button,
  Typography,
  DialogTitle,
  DialogActions,
  DialogContent,
  Autocomplete,
  MenuItem,
  Grid,
  Dialog,
  CircularProgress,
  TextField,
  Box,
  Stack,
} from '@mui/material'
import { Suspense, useMemo } from 'react'
import {
  Controller,
  FormProvider,
  useForm,
  useFormState,
} from 'react-hook-form'

import type { GetGameDialogFieldsQuery } from '@src/graphql/operations'
import {
  GetGameDialogFieldsDocument,
  type GetGameDialogFieldsQuery,
  GetGameListQueryDocument,
  StartGameBetterDocument,
  StartGameDocument,
  UpdateGameDocument,
} from '@src/graphql/operations'
import type { Game } from '@src/graphql/types'
import DelayedOnCloseDialog, {
  DelayedOnCloseDialogCloseIcon,
  useDelayedOnCloseDialogTriggerClose,
} from '@src/lib/DelayedOnCloseDialog'
import StarRating from '@src/lib/StarRating'
import ReactHookFormTextField from '@src/react-hook-form/ReactHookFormTextField'

import GameDialogFileList from './GameDialogFileList'
import {
  GameFileListProvider,
  useGameFileListContext,
} from './GameFileListContext'
import type { GameListGame } from './GameList'
import isIwad from './isIwad'
import useAllTags from './useAllTags'

export interface GameDialogFormValues {
  id: Game['id']
  notes: Game['notes']
  rating: Game['rating']
  tags: Game['tags']
  iwadId: NonNullable<Game['iwad_id']>
  extraGameIds: (string | GameListGame)[]
}

interface GameDialogProps {
  gameId: Game['id']
  open: boolean
  onClose: (event: unknown, reason: string) => void
}

const GameDialog: React.FC<GameDialogProps> = (props) => {
  return (
    <Suspense
      fallback={
        <Dialog open={props.open}>
          <DialogContent>
            <Box padding={4} justifyContent="center">
              <CircularProgress />
            </Box>
          </DialogContent>
        </Dialog>
      }
    >
      <DelayedOnCloseDialog
        open={props.open}
        onClose={props.onClose}
        maxWidth="lg"
        fullWidth
      >
        <GameDialogInner gameId={props.gameId} onClose={props.onClose} />
      </DelayedOnCloseDialog>
    </Suspense>
  )
}

const GameDialogInner: React.FC<{
  gameId: GameDialogProps['gameId']
  onClose: GameDialogProps['onClose']
}> = (props) => {
  const allTags = useAllTags(true)
  const {
    data: { getGame: fullGame, getGames: games },
  } = useSuspenseQuery(GetGameDialogFieldsDocument, {
    variables: {
      game_id: props.gameId,
    },
  })

  const [updateGame] = useMutation(UpdateGameDocument)

  const { iwads, others } = useMemo(() => {
    const iwads: GetGameDialogFieldsQuery['getGames'] = []
    const others: GetGameDialogFieldsQuery['getGames'] = []

    for (const game of games || []) {
      if (isIwad(game.tags)) {
        iwads.push(game)
      } else if (game.id !== props.gameId) {
        others.push(game)
      }
    }

    return {
      iwads,
      others,
    }
  }, [games, props.gameId])

  const formApi = useForm<GameDialogFormValues>({
    defaultValues: {
      id: props.gameId,
      rating: fullGame.rating,
      // description: '',
      notes: fullGame.notes,
      tags: fullGame.tags,

      // sourcePortId: '',
      iwadId: fullGame.iwad_id || '',
      extraGameIds: fullGame.extra_mod_ids || [],
    },
  })

  const tags = formApi.watch('tags')
  const isGameIwad = isIwad(tags)

  return (
    <FormProvider {...formApi}>
      <GameFileListProvider>
        <DialogTitle>
          <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            spacing="space-between"
          >
            <div>
              {fullGame.name}

              <Controller
                name="rating"
                render={(renderProps) => {
                  return (
                    <StarRating
                      value={renderProps.field.value}
                      onChange={(value) => {
                        if (renderProps.formState.isSubmitting) {
                          return
                        }

                        renderProps.field.onChange(value)
                      }}
                    />
                  )
                }}
              />
            </div>
            <div>
              <DelayedOnCloseDialogCloseIcon />
            </div>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography>{fullGame.description}</Typography>

              <Controller
                name="tags"
                render={({
                  field: { ref, onChange, ...field },
                  fieldState,
                  formState,
                }) => {
                  const isDisabled = formState.isSubmitting
                  const errorMessage = fieldState.error?.message

                  return (
                    <Autocomplete<string, true, undefined, true>
                      {...field}
                      openOnFocus
                      ChipProps={{ size: 'small' }}
                      renderInput={(props) => (
                        <TextField
                          {...props}
                          label="Tags"
                          inputRef={ref}
                          error={fieldState.invalid}
                          helperText={errorMessage}
                        />
                      )}
                      disabled={isDisabled}
                      freeSolo
                      onChange={(_event, value) => {
                        onChange(value)
                      }}
                      options={allTags}
                      multiple
                    />
                  )
                }}
              />

              {/*
                  This field is a little tricky:

                  If the game is tagged with `iwad`, it gets disabled and the
                  value is forced to the current game id.

                  That latter part means we can't easily use `ReactHookFormTextField`
                  */}
              <Controller<GameDialogFormValues, 'iwadId'>
                name="iwadId"
                render={({
                  field: { ref, ...field },
                  fieldState,
                  formState,
                }) => {
                  const isDisabled = isGameIwad || formState.isSubmitting
                  const errorMessage = fieldState.error?.message

                  return (
                    <TextField
                      {...field}
                      label="IWAD"
                      select
                      disabled={isDisabled}
                      error={fieldState.invalid}
                      value={isGameIwad ? fullGame.id : field.value}
                      helperText={errorMessage}
                    >
                      <MenuItem value="">None</MenuItem>

                      {iwads.map((x) => {
                        return (
                          <MenuItem key={x.id} value={x.id}>
                            {x.name}
                          </MenuItem>
                        )
                      })}
                    </TextField>
                  )
                }}
              />

              <ReactHookFormTextField
                name="extraGameIds"
                select
                SelectProps={{
                  multiple: true,
                }}
                label="Mods"
              >
                {others.map((x) => {
                  return (
                    <MenuItem key={x.id} value={x.id}>
                      {x.name}
                    </MenuItem>
                  )
                })}
              </ReactHookFormTextField>

              <ReactHookFormTextField
                name="notes"
                label="Notes"
                multiline
                minRows={2}
                maxRows={8}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Suspense fallback={<CircularProgress />}>
                <GameDialogFileList />
              </Suspense>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <GameDialogActions
            game={fullGame}
            submitForm={formApi.handleSubmit(async (values) => {
              await updateGame({
                variables: {
                  game: {
                    id: props.gameId,
                    rating: values.rating,
                    // description: values.description,
                    notes: values.notes,
                    tags: values.tags,

                    // source_port: values.source_port_id,
                    iwad_id: values.iwadId ? values.iwadId : null,
                    extra_mod_ids: values.extraGameIds.map((x) =>
                      typeof x === 'string' ? x : x.id,
                    ),
                    // enabled_files: values.enabledFiles,
                  },
                },
              })
            })}
            resetForm={() => {
              formApi.reset()
            }}
          />
        </DialogActions>
      </GameFileListProvider>
    </FormProvider>
  )
}

const GameDialogActions: React.FC<{
  game: GetGameDialogFieldsQuery['getGame']
  resetForm: () => void
  submitForm: (event: React.BaseSyntheticEvent) => Promise<void>
}> = (props) => {
  const [startGameMutation] = useMutation(StartGameDocument, {
    refetchQueries: [{ query: GetGameListQueryDocument }],
  })
  const { files: allFiles } = useGameFileListContext()
  const triggerClose = useDelayedOnCloseDialogTriggerClose()
  const formState = useFormState()

  return (
    <>
      <Button
        color="warning"
        onClick={() => {
          props.resetForm()
        }}
      >
        Reset
      </Button>

      <Button
        onClick={async (event) => {
          await props.submitForm(event)
          triggerClose('closeClick')
        }}
      >
        Save
      </Button>

      <Button
        variant="contained"
        onClick={async (event) => {
          try {
            await props.submitForm(event)

            const files: string[] = []
            let iwad: string | undefined = undefined

            for (const fileEntry of allFiles) {
              if (!fileEntry.selected) {
                continue
              }

              if (fileEntry.isIwad) {
                iwad = fileEntry.absolute
              } else {
                files.push(fileEntry.absolute)
              }
            }

            const startGameResponse = await startGameMutation({
              variables: {
                game_id: props.game.id,
                source_port:
                  '/Users/mike/Documents/GZDoom Launcher/SourcePorts/GZDoom.app/Contents/MacOS/gzdoom',
                iwad,
                files,
              },
            })

            if (!startGameResponse.data?.startGame) {
              throw new Error('startGame returned false')
            }
          } catch (err) {
            console.error(err)
          }
        }}
        disabled={formState.isSubmitting || !formState.isValid}
      >
        Play
      </Button>
    </>
  )
}

export default GameDialog
