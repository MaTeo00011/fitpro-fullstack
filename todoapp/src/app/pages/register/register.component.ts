import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { GymUserService, GymUser } from '../../services/gym-user.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { isEmptyString, trimString } from '../../utils/validation.util';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {

  registerForm: FormGroup;
  showPersonalizedModal = false;
  selectedPersonalizedType: string | null = null;
  personalizedTypes = [
    { value: 'fuerza', label: 'Fuerza' },
    { value: 'bajar_peso', label: 'Bajar de Peso' },
    { value: 'definicion', label: 'Definición' },
    { value: 'resistencia', label: 'Resistencia' },
    { value: 'tonificacion', label: 'Tonificación' }
  ];

  paymentTypes = [
    { value: 'dia', label: 'Día' },
    { value: 'semana', label: 'Semana' },
    { value: 'mes', label: 'Mes' },
    { value: 'trimestre', label: 'Trimestre' },
    { value: 'semestre', label: 'Semestre' },
    { value: 'ano', label: 'Año' }
  ];

  constructor(
    private fb: FormBuilder,
    private gymUserService: GymUserService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      age: ['', [Validators.required, Validators.min(10), Validators.max(150)]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      trainingType: ['general', Validators.required],
      paymentType: ['mes', Validators.required],
      paymentStart: [new Date().toISOString().split('T')[0], Validators.required]  // Fecha actual por defecto
    });
  }

  onTrainingTypeChange() {
    const trainingType = this.registerForm.get('trainingType')?.value;
    if (trainingType === 'personalized') {
      this.showPersonalizedModal = true;
    } else {
      this.showPersonalizedModal = false;
      this.selectedPersonalizedType = null;
    }
  }

  closeModal() {
    this.showPersonalizedModal = false;
    // Resetear a general si no confirma
    this.registerForm.patchValue({ trainingType: 'general' });
    this.selectedPersonalizedType = null;
  }

  confirmPersonalized(type: string) {
    this.selectedPersonalizedType = type;
    this.showPersonalizedModal = false;
  }

  onSubmit() {
    const formValue = this.registerForm.value;

    // Validación adicional para evitar entradas que contengan solo espacios
    if (isEmptyString(formValue.firstName) || isEmptyString(formValue.lastName) || isEmptyString(formValue.phone)) {
      this.notificationService.notify('Rellena los campos vacíos y corrige los errores del formulario.', 'error');
      return;
    }

    if (!this.registerForm.valid) {
      this.notificationService.notify('Rellena los campos vacíos y corrige los errores del formulario.', 'error');
      return;
    }

    if (formValue.trainingType === 'personalized' && !this.selectedPersonalizedType) {
      this.notificationService.notify('Selecciona un tipo de entrenamiento personalizado para continuar.', 'error');
      return;
    }

    const userData: Omit<GymUser, 'id' | 'createdAt' | 'updatedAt' | 'paymentEnd' | 'status'> = {
      ...formValue,
      firstName: trimString(formValue.firstName),
      lastName: trimString(formValue.lastName),
      phone: trimString(formValue.phone),
      paymentStart: new Date(formValue.paymentStart),
      personalizedDetails: formValue.trainingType === 'personalized' && this.selectedPersonalizedType
        ? { type: this.selectedPersonalizedType as any }
        : undefined
    };

    this.gymUserService.addUser(userData).subscribe(result => {
      if (result) {
        this.notificationService.notify('Usuario registrado exitosamente.', 'success');
        const fullName = `${result.firstName} ${result.lastName}`;
        this.authService.loginUser(fullName).subscribe(loginResult => {
          if (loginResult.success) {
            this.router.navigate(['/home']);
          } else {
            this.notificationService.notify('Registro exitoso, pero no se pudo iniciar sesión automáticamente.', 'info');
            this.router.navigate(['/home']);
          }
        });
      } else {
        this.notificationService.notify('Error al registrar el usuario. Intenta nuevamente.', 'error');
      }
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }
}