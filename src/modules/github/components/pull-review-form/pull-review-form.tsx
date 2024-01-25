import { type ChangeEvent, type FC, useEffect, useState } from 'react'

import { AlertDialog } from '@/elements/root/alert-dialog/alert-dialog'
import { Alert } from '@/elements/root/alert/alert'
import { Button } from '@/elements/root/button/button'
import { Progress } from '@/elements/root/progress/progress'
import { Textarea } from '@/elements/root/textarea/textarea'
import { useToast } from '@/elements/root/toast/toast-provider'

import { useDictionary } from '@/contexts/root/dictionary-provider/dictionary-provider'

import { githubService } from '@/services/root/github'

import {
  getCheckedPullsInfo,
  processSubmit
} from '@/components/github/root/pull-review-form/utils'

import { EPullRequestType, type TRepoHasCheck } from '@/types/github/root/index'

interface PullReviewFormProps {
  repoHasCheckArray: TRepoHasCheck[]
}

interface Errors {
  repo: string
  pullTitle: string
}

export const PullReviewForm: FC<PullReviewFormProps> = ({
  repoHasCheckArray
}) => {
  const [currentUser, setCurrentUser] = useState<string>('')
  const [errors, setErrors] = useState<Errors[]>([])
  const [commentInput, setCommentInput] = useState<string>('')
  const [dialogData, setDialogData] = useState<
    | {
        open: true
        type: EPullRequestType
        title: string
      }
    | {
        open: false
        type?: never
        title?: never
      }
  >({ open: false })
  const [progressData, setProgressData] = useState<
    | {
        isRunning: true
        value: number
      }
    | {
        isRunning: false
        value?: never
      }
  >({ isRunning: false })
  const { translate } = useDictionary()
  const { pushToast } = useToast()
  const hasComment = commentInput.length > 0
  const hasChecked = repoHasCheckArray.some((data) =>
    data.pulls.some((pull) => pull.isChecked === true)
  )
  const hasMyPull = getCheckedPullsInfo(repoHasCheckArray).some(
    (data) => data.user.login === currentUser
  )

  const handleCommentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setCommentInput(event.target.value)
  }

  const submit = (pullRequestType: EPullRequestType) => {
    const checkedPullsInfo = getCheckedPullsInfo(repoHasCheckArray)
    const progressIncreaseValue = 100 / checkedPullsInfo.length

    const handleProgressing = () => {
      setProgressData((prev) => {
        const value = prev.value! + progressIncreaseValue

        return {
          isRunning: true,
          value: value > 100 ? 100 : value
        }
      })
    }

    setProgressData({ isRunning: true, value: 0 })
    processSubmit(
      checkedPullsInfo,
      handleProgressing,
      pullRequestType,
      commentInput
    )
      .then((result) => {
        if (result.every((item) => item.status === 'fulfilled')) {
          setDialogData({ open: false })
          setProgressData({ isRunning: false })
          pushToast({
            title: translate('GITHUB.TOAST_SUCCESS_TITLE'),
            variant: 'success'
          })
        } else {
          const errors = result.reduce<Errors[]>((accu, item, index) => {
            if (item.status === 'rejected') {
              return accu.concat([
                {
                  repo: checkedPullsInfo[index]!.repo,
                  pullTitle: checkedPullsInfo[index]!.pullTitle
                }
              ])
            }

            return accu
          }, [])
          setErrors(errors)
        }
      })
      .catch(console.error)
  }

  const handleOpenDialog = (type: EPullRequestType) => {
    if (type === EPullRequestType.COMMENT) {
      setDialogData({
        open: true,
        type,
        title: translate('GITHUB.PULL_REVIEW_FORM_COMMENT_BUTTON')
      })
    } else if (type === EPullRequestType.APPROVE) {
      setDialogData({
        open: true,
        type,
        title: translate('GITHUB.PULL_REVIEW_FORM_APPROVE_BUTTON')
      })
    } else if (type === EPullRequestType.REQUEST_CHANGES) {
      setDialogData({
        open: true,
        type,
        title: translate('GITHUB.PULL_REVIEW_FORM_REQUEST_CHANGES_BUTTON')
      })
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (open === false) {
      setDialogData({ open })
      setProgressData({ isRunning: false })
      setErrors([])
    }
  }

  const handleActionClick = () => {
    if (!dialogData.open) {
      return
    }
    submit(dialogData.type)
  }

  useEffect(() => {
    githubService
      .getUser()
      .then((user) => setCurrentUser(user.login))
      .catch(() => console.error)
  }, [])

  return (
    <>
      <div className="flex flex-col h-full">
        <Textarea
          className="resize-none flex-grow"
          placeholder={translate('GITHUB.PULL_REVIEW_FORM_COMMENT_PLACEHOLDER')}
          value={commentInput}
          onChange={handleCommentChange}
          disabled={!hasChecked}
        />

        <div className="mt-5 flex justify-end gap-2">
          <AlertDialog
            open={dialogData.open}
            onOpenChange={handleOpenChange}
            onActionClick={handleActionClick}
            title={dialogData.title}
            children={
              <>
                {progressData.isRunning && (
                  <Progress value={progressData.value} max={100} />
                )}

                {errors.length > 0 && (
                  <Alert
                    variant="error"
                    title="error"
                    description={
                      <div>
                        {errors.map((error, index) => (
                          <div key={index}>
                            {translate(
                              'GITHUB.PULL_REVIEW_FORM_SUBMIT_DESCRIPTION_REPO',
                              { repoName: error.repo }
                            )}
                            <br />
                            {translate(
                              'GITHUB.PULL_REVIEW_FORM_SUBMIT_DESCRIPTION_PULL',
                              { pullTitle: error.pullTitle }
                            )}
                          </div>
                        ))}
                      </div>
                    }
                  />
                )}
              </>
            }
            actionLabel={translate('COMMON.ALERT_DIALOG_DEFAULT_SUBMIT_BUTTON')}
          ></AlertDialog>

          <Button
            type="button"
            disabled={!hasChecked || !hasComment}
            label={translate('GITHUB.PULL_REVIEW_FORM_COMMENT_BUTTON')}
            onClick={() => handleOpenDialog(EPullRequestType.COMMENT)}
          ></Button>

          <Button
            type="button"
            disabled={!hasChecked || hasMyPull}
            label={translate('GITHUB.PULL_REVIEW_FORM_APPROVE_BUTTON')}
            onClick={() => handleOpenDialog(EPullRequestType.APPROVE)}
          ></Button>

          <Button
            type="button"
            disabled={!hasChecked || hasMyPull || !hasComment}
            label={translate('GITHUB.PULL_REVIEW_FORM_REQUEST_CHANGES_BUTTON')}
            onClick={() => handleOpenDialog(EPullRequestType.REQUEST_CHANGES)}
          ></Button>
        </div>
      </div>
    </>
  )
}
