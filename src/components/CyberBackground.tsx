import { useEffect, useRef } from 'react';

export function CyberBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particlesArray: Particle[] = [];
    let bloodDropsArray: BloodDrop[] = [];
    const maxParticles = 40;
    const maxBloodDrops = 45;
    let animationFrameId: number;

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    class BloodDrop {
      x!: number;
      y!: number;
      length!: number;
      speedY!: number;
      speedX!: number;
      opacity!: number;
      width!: number;

      constructor() {
        this.reset();
      }

      reset() {
        if (!canvas) return;
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * -canvas.height;
        this.length = Math.random() * 20 + 10;
        this.speedY = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.6 + 0.2;
        this.width = Math.random() * 1.5 + 0.5;
      }

      update() {
        if (!canvas) return;
        this.y += this.speedY;
        this.x += this.speedX;
        if (this.y > canvas.height) {
          this.reset();
        }
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.length);
        gradient.addColorStop(0, 'rgba(255, 0, 60, 0)');
        gradient.addColorStop(1, `rgba(255, 0, 60, ${this.opacity})`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = this.width;
        ctx.lineCap = 'round';
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, this.y + this.length);
        ctx.stroke();
      }
    }

    class Particle {
      x!: number;
      y!: number;
      size!: number;
      speedX!: number;
      speedY!: number;
      opacity!: number;

      constructor() {
        this.reset();
      }

      reset() {
        if (!canvas) return;
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 1.5 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.4 + 0.15;
      }

      update() {
        if (!canvas) return;
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 247, 255, ${this.opacity})`;
        ctx.shadowBlur = 3;
        ctx.shadowColor = '#00F7FF';
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }
    }

    // Initialize particles and blood drops
    particlesArray = Array.from({ length: maxParticles }, () => new Particle());
    bloodDropsArray = Array.from({ length: maxBloodDrops }, () => new BloodDrop());

    const animate = () => {
      if (!canvas || !ctx) return;
      ctx.fillStyle = 'rgba(3, 3, 5, 0.18)'; // trails black effect
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Blood drops Rain falling
      for (let i = 0; i < bloodDropsArray.length; i++) {
        bloodDropsArray[i].update();
        bloodDropsArray[i].draw();
      }

      // Cyan nodes connecting lines
      for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();

        for (let j = i + 1; j < particlesArray.length; j++) {
          const dx = particlesArray[i].x - particlesArray[j].x;
          const dy = particlesArray[i].y - particlesArray[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 110) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 247, 255, ${(1 - distance / 110) * 0.08})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particlesArray[i].x, particlesArray[i].y);
            ctx.lineTo(particlesArray[j].x, particlesArray[j].y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-0 pointer-events-none" />
      <div className="crt-scanlines" />
    </>
  );
}
