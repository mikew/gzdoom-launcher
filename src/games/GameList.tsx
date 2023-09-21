import { useMutation, useSuspenseQuery } from '@apollo/client'
import FolderOpen from '@mui/icons-material/FolderOpen'
import PlayArrow from '@mui/icons-material/PlayArrow'
import {
  AppBar,
  Box,
  Button,
  Chip,
  IconButton,
  Input,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
} from '@mui/material'
import useSimpleFilter from '@promoboxx/use-filter/dist/useSimpleFilter'
import { useMemo, useState } from 'react'

import {
  GetGameListQueryDocument,
  GetGameListQueryQuery,
  OpenGamesFolderDocument,
  SetRatingDocument,
  StartGameDocument,
} from '@src/graphql/operations'
import StarRating from '@src/lib/StarRating'

import GameDialog from './GameDialog'

type ArrayItemType<T> = T extends Array<infer A> ? A : never

export type GameListGame = ArrayItemType<GetGameListQueryQuery['getGames']>

const GameList: React.FC = () => {
  const { data } = useSuspenseQuery(GetGameListQueryDocument)

  const [openGamesFolderMutation] = useMutation(OpenGamesFolderDocument)
  const [startGameMutation] = useMutation(StartGameDocument)
  const [setRating] = useMutation(SetRatingDocument)
  const [selectedId, setSelectedId] = useState<GameListGame['id']>()
  const selectedGame = useMemo(() => {
    return data.getGames.find((x) => x.id === selectedId)
  }, [data.getGames, selectedId])

  const { debouncedFilterInfo, filterInfo, updateFilter, resetFilter } =
    useSimpleFilter('GameList', {
      defaultFilterInfo: {
        filter: {
          name: '',
          rating: 0,
        },
      },
    })

  async function startGame(_game: GameListGame) {
    try {
      const startGameResponse = await startGameMutation({
        variables: {
          source_port:
            '/Users/mike/Downloads/gzdoom-4-10-0-macOS/GZDoom.app/Contents/MacOS/gzdoom',
          iwad: '/Users/mike/Downloads/DOOM2.WAD',
          files: [
            '/Users/mike/Documents/GZDoom Launcher/Games/GoldenSouls2_1.4/GoldenSouls2_1.4.pk3',
          ],
        },
      })

      if (!startGameResponse.data?.startGame) {
        throw new Error('startGame returned false')
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function openGamesFolder(game_id?: string) {
    try {
      const response = await openGamesFolderMutation({
        variables: {
          game_id,
        },
      })

      if (!response.data?.openGamesFolder) {
        throw new Error('openGamesFolder returned false')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = useMemo(() => {
    return data.getGames.filter((x) => {
      if (
        !debouncedFilterInfo.filter.name &&
        !debouncedFilterInfo.filter.rating
      ) {
        return true
      }

      let shouldInclude = false

      if (
        debouncedFilterInfo.filter.name &&
        x.name
          .toLowerCase()
          .includes(debouncedFilterInfo.filter.name.toLowerCase())
      ) {
        shouldInclude = true
      }

      if (
        debouncedFilterInfo.filter.rating &&
        x.rating <= debouncedFilterInfo.filter.rating
      ) {
        shouldInclude = true
      }

      return shouldInclude
    })
  }, [
    data.getGames,
    debouncedFilterInfo.filter.name,
    debouncedFilterInfo.filter.rating,
  ])

  return (
    <>
      <AppBar position="sticky">
        <Toolbar>
          <Stack direction="row" spacing={1}>
            <Input
              size="small"
              margin="none"
              value={filterInfo.filter.name}
              placeholder="Filter ..."
              onChange={(event) => {
                updateFilter({ name: event.target.value })
              }}
            />

            <StarRating
              value={debouncedFilterInfo.filter.rating}
              onChange={(value) => {
                updateFilter({ rating: value }, true)
              }}
            />

            <Button onClick={() => resetFilter(true)}>Reset</Button>
          </Stack>

          <Box flexGrow="1" />

          <Button
            onClick={() => {
              openGamesFolder()
            }}
            startIcon={<FolderOpen />}
          >
            Open Games Folder
          </Button>
        </Toolbar>
      </AppBar>

      <List disablePadding dense>
        {filtered.map((x) => {
          return (
            <ListItem key={x.id} disableGutters disablePadding divider>
              <ListItemButton
                disableRipple
                onClick={() => {
                  setSelectedId(x.id)
                }}
              >
                <ListItemText
                  primary={x.name}
                  secondary={
                    <>
                      {x.play_sessions.reduce(
                        (memo, x) => memo + x.duration,
                        0,
                      )}
                      s played /{x.notes}
                    </>
                  }
                />
              </ListItemButton>

              <Stack direction="row" spacing={1} alignItems="center">
                <Stack direction="row" spacing={1}>
                  {x.tags.map((tag) => {
                    return (
                      <Chip
                        variant="outlined"
                        size="small"
                        key={tag}
                        label={tag}
                      />
                    )
                  })}
                </Stack>

                <StarRating
                  value={x.rating}
                  onChange={(value) => {
                    setRating({
                      variables: {
                        game_id: x.id,
                        rating: value,
                      },
                    })
                  }}
                />

                <IconButton
                  onClick={() => {
                    startGame(x)
                  }}
                  size="small"
                >
                  <PlayArrow />
                </IconButton>

                <IconButton
                  onClick={() => {
                    openGamesFolder(x.id)
                  }}
                  size="small"
                >
                  <FolderOpen />
                </IconButton>
              </Stack>
            </ListItem>
          )
        })}
      </List>

      {selectedGame ? (
        <GameDialog
          game={selectedGame}
          onClose={() => setSelectedId(undefined)}
        />
      ) : undefined}
    </>
  )
}

export default GameList
