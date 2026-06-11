import { Component } from "@angular/core";
import { IonSegment, IonSegmentButton, IonLabel } from "@ionic/angular/standalone";

@Component({
    selector: "app-model-segments",
    standalone: true,
    templateUrl: "./modelSegments.component.html",
    styleUrls: ["./modelSegments.component.scss"],
    imports: [IonSegment, IonSegmentButton, IonLabel],
})
export class ModelSegmentsComponent {
    
}