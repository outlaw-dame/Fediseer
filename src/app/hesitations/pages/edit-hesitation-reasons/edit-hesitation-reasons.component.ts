import {Component} from '@angular/core';
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {TitleService} from "../../../services/title.service";
import {MessageService} from "../../../services/message.service";
import {FediseerApiService} from "../../../services/fediseer-api.service";
import {ActivatedRoute, Router} from "@angular/router";
import {AuthenticationManagerService} from "../../../services/authentication-manager.service";
import {ApiResponseHelperService} from "../../../services/api-response-helper.service";
import {toPromise} from "../../../types/resolvable";
import {map} from "rxjs";
import {NormalizedInstanceDetailResponse} from "../../../response/normalized-instance-detail.response";
import {CachedFediseerApiService} from "../../../services/cached-fediseer-api.service";

@Component({
  selector: 'app-edit-hesitation-reasons',
  templateUrl: './edit-hesitation-reasons.component.html',
  styleUrls: ['./edit-hesitation-reasons.component.scss']
})
export class EditHesitationReasonsComponent {
  public form = new FormGroup({
    instance: new FormControl<string>({value: '', disabled: true}, [Validators.required]),
    reasons: new FormControl<string[]>([]),
    evidence: new FormControl<string | null>(null),
  });
  public loading: boolean = true;
  public availableReasons: string[] = [];

  constructor(
    private readonly titleService: TitleService,
    private readonly messageService: MessageService,
    private readonly api: FediseerApiService,
    private readonly cachedApi: CachedFediseerApiService,
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly authManager: AuthenticationManagerService,
    private readonly apiResponseHelper: ApiResponseHelperService,
  ) {
  }

  public async ngOnInit(): Promise<void> {
    this.titleService.title = 'Update hesitation reasons';

    this.activatedRoute.params.subscribe(async params => {
      const targetInstance = params['instance'] as string;
      let availableReasons = await toPromise(this.cachedApi.getUsedReasons());
      if (availableReasons === null) {
        this.messageService.createWarning(`Couldn't get list of reasons that were used previously, autocompletion won't work.`);
        availableReasons = [];
      }
      this.availableReasons = availableReasons;

      const existing = await toPromise(
        this.api.getHesitationsByInstances([this.authManager.currentInstanceSnapshot.name]).pipe(
          map(response => {
            if (this.apiResponseHelper.handleErrors([response])) {
              return null;
            }

            const instance = response.successResponse!.instances.filter(
              instance => instance.domain === targetInstance,
            );
            if (!instance.length) {
              this.messageService.createError(`Couldn't find this instance amongst your hesitations. Are you sure you've hesitated on it?`);
              return null;
            }

            return instance[0];
          }),
        ),
      );

      if (existing === null) {
        this.loading = false;
        return;
      }

      this.form.patchValue({
        instance: existing.domain,
        reasons: NormalizedInstanceDetailResponse.fromInstanceDetail(existing).unmergedHesitationReasons,
        evidence: NormalizedInstanceDetailResponse.fromInstanceDetail(existing).hesitationsEvidence,
      });
      this.loading = false;
    });
  }

  public async updateReasons(): Promise<void> {
    if (!this.form.valid) {
      this.messageService.createError("The form is not valid, please make sure all fields are filled correctly.");
      return;
    }

    this.loading = true;
    this.api.updateHesitation(
      this.form.controls.instance.value!,
      this.form.controls.reasons.value ? this.form.controls.reasons.value!.join(',') : null,
      this.form.controls.evidence.value,
    ).subscribe(response => {
      if (this.apiResponseHelper.handleErrors([response])) {
        this.loading = false;
        return;
      }

      this.loading = false;
      this.router.navigateByUrl('/hesitations/my').then(() => {
        this.messageService.createSuccess(`${this.form.controls.instance.value} was successfully updated!`);
      });
    });
  }
}
